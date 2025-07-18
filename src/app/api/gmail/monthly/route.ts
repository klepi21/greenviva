import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { format, parse, startOfYear, endOfYear } from 'date-fns';
import { authOptions } from '../../auth/[...nextauth]/auth.config';
import { MonthlyCacheService, MonthlyTotal } from '@/lib/monthlyCache';

const cache = new MonthlyCacheService();
const BATCH_SIZE = 10; // Number of emails to process in parallel
const MAX_RETRIES = 3;

interface MessageHeader {
  name: string;
  value: string;
}

interface MessagePart {
  mimeType: string;
  body?: {
    data?: string;
  };
}

const getGmailClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
};

function parseAmount(body: string): number | null {
  const amountMatch = body.match(/(?:Amount|Ποσό|Amount:)\s*[:]*\s*[€]?\s*(\d+(?:\.\d{2})?)/i);
  return amountMatch ? parseFloat(amountMatch[1]) : null;
}

async function processEmail(gmail: any, messageId: string, retryCount = 0): Promise<{ amount: number; date: Date } | null> {
  try {
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const payload = email.data.payload!;
    const headers = payload.headers! as MessageHeader[];
    const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date');
    
    if (!dateHeader?.value) {
      return null;
    }

    const body = payload.parts?.[0]?.body?.data ||
                payload.body?.data || '';
    const decodedBody = Buffer.from(body, 'base64').toString('utf8');
    const amount = parseAmount(decodedBody);

    if (!amount) {
      return null;
    }

    return {
      amount,
      date: new Date(dateHeader.value)
    };
  } catch (error: any) {
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      // Rate limit hit, wait and retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return processEmail(gmail, messageId, retryCount + 1);
    }
    throw error;
  }
}

async function processBatch(gmail: any, messageIds: string[]): Promise<{ amount: number; date: Date }[]> {
  const results = await Promise.allSettled(
    messageIds.map(id => processEmail(gmail, id))
  );

  // If any result is a rate limit error, throw a 429
  for (const result of results) {
    if (result.status === 'rejected' && result.reason?.response?.status === 429) {
      throw { code: 429, message: 'Rate limit exceeded' };
    }
  }

  return results
    .filter((result): result is PromiseFulfilledResult<{ amount: number; date: Date }> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // Generate cache key
    const cacheKey = `monthly-${year}`;
    
    // Try to get from cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log('Returning cached data for:', cacheKey);
      return NextResponse.json({ monthlyTotals: cachedData });
    }

    const startDate = startOfYear(new Date(year, 0));
    const endDate = endOfYear(new Date(year, 0));

    // @ts-ignore - We know the token exists because we checked for session
    const gmail = await getGmailClient(session.accessToken);

    const query = `from:no-reply@viva.com after:${format(startDate, 'yyyy/MM/dd')} before:${format(endDate, 'yyyy/MM/dd')}`;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500,
    });

    const messages = response.data.messages || [];
    const transfers: { amount: number; date: Date }[] = [];

    // Process messages in batches
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await processBatch(gmail, batch.map(m => m.id!));
        transfers.push(...batchResults);
      } catch (err: any) {
        if (err.code === 429) {
          return NextResponse.json({ error: 'Too many requests. Please try again in a few minutes.' }, { status: 429 });
        }
        throw err;
      }
      // Add a delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Group transfers by month
    const monthlyTotals: { [key: string]: { totalAmount: number; numberOfTransfers: number } } = {};

    transfers.forEach(transfer => {
      const monthKey = format(transfer.date, 'MMMM yyyy');
      
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = { totalAmount: 0, numberOfTransfers: 0 };
      }

      monthlyTotals[monthKey].totalAmount += transfer.amount;
      monthlyTotals[monthKey].numberOfTransfers += 1;
    });

    // Convert to array and sort by date
    const monthlyTotalsArray: MonthlyTotal[] = Object.entries(monthlyTotals).map(([month, data]) => ({
      month,
      ...data
    })).sort((a, b) => {
      const dateA = parse(a.month, 'MMMM yyyy', new Date());
      const dateB = parse(b.month, 'MMMM yyyy', new Date());
      return dateA.getTime() - dateB.getTime();
    });

    // Cache the results
    await cache.set(cacheKey, monthlyTotalsArray);

    return NextResponse.json({ monthlyTotals: monthlyTotalsArray });
  } catch (error) {
    console.error('Error in monthly data fetch:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly data' }, { status: 500 });
  }
} 