import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { format, parseISO, startOfDay, endOfDay, addDays } from 'date-fns';
import { authOptions } from '../auth/[...nextauth]/auth.config';
import { CacheService } from '@/lib/cache';

interface Transfer {
  from: string;
  amount: number;
  timestamp: string;
}

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

const cache = new CacheService();
const BATCH_SIZE = 10; // Number of emails to process in parallel
const MAX_RETRIES = 3;

function parseEmailBody(body: string): Transfer | null {
  try {
    // Look for common patterns in Viva.com transfer emails
    const fromMatch = body.match(/(?:From|Από|From:)\s*[:]*\s*(.*?)(?:\r?\n|$)/i);
    const amountMatch = body.match(/(?:Amount|Ποσό|Amount:)\s*[:]*\s*[€]?\s*(\d+(?:\.\d{2})?)/i);

    console.log('Email parsing:', {
      hasFromMatch: !!fromMatch,
      fromMatchGroups: fromMatch ? fromMatch.groups : null,
      hasAmountMatch: !!amountMatch,
      amountMatchGroups: amountMatch ? amountMatch.groups : null,
      bodyPreview: body.substring(0, 200)
    });

    if (!fromMatch || !amountMatch) {
      return null;
    }

    return {
      from: fromMatch[1].trim(),
      amount: parseFloat(amountMatch[1]),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error parsing email:', error);
    return null;
  }
}

function decodeEmailBody(encodedBody: string): string {
  try {
    const buffer = Buffer.from(encodedBody, 'base64');
    return buffer.toString('utf-8');
  } catch {
    return encodedBody;
  }
}

async function processEmail(gmail: any, messageId: string, retryCount = 0): Promise<Transfer | null> {
  try {
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const payload = email.data.payload!;
    const headers = payload.headers! as MessageHeader[];
    const emailDate = headers.find((h: MessageHeader) => h.name === 'Date')?.value;

    if (!emailDate) {
      console.log(`No date found for message ${messageId}`);
      return null;
    }

    let emailBody = '';
    if (payload.body?.data) {
      emailBody = decodeEmailBody(payload.body.data);
    } else if (payload.parts) {
      const textPart = payload.parts.find((part: MessagePart) => 
        part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      if (textPart?.body?.data) {
        emailBody = decodeEmailBody(textPart.body.data);
      }
    }

    const transfer = parseEmailBody(emailBody);
    if (transfer) {
      transfer.timestamp = emailDate;
      return transfer;
    }
    return null;
  } catch (error: any) {
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      // Rate limit hit, wait and retry
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return processEmail(gmail, messageId, retryCount + 1);
    }
    throw error;
  }
}

async function processBatch(gmail: any, messageIds: string[]): Promise<Transfer[]> {
  const results = await Promise.allSettled(
    messageIds.map(id => processEmail(gmail, id))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<Transfer> => 
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.error('Authentication error: No session or email found');
      return NextResponse.json({ error: 'Please sign in to access your transfers' }, { status: 401 });
    }

    if (!session.accessToken) {
      console.error('Authentication error: No access token found');
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const dateParam = searchParams.get('date');
    const date = dateParam ? parseISO(dateParam) : new Date();
    
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Generate cache key
    const cacheKey = `transfers-${format(date, 'yyyy-MM-dd')}`;
    
    // Try to get from cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      console.log('Returning cached data for:', cacheKey);
      return NextResponse.json({ transfers: cachedData });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ 
      access_token: session.accessToken as string,
      refresh_token: session.refreshToken as string
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Gmail API query using RFC3339 date format
    const query = `from:no-reply@viva.com after:${format(dayStart, 'yyyy/MM/dd')} before:${format(addDays(dayEnd, 1), 'yyyy/MM/dd')}`;
    console.log('Gmail Query:', query);

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });

    const messages = response.data.messages || [];
    const transfers: Transfer[] = [];

    // Process messages in batches
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(gmail, batch.map(m => m.id!));
      transfers.push(...batchResults);
    }

    // Sort transfers by timestamp
    const sortedTransfers = transfers.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Cache the results
    await cache.set(cacheKey, sortedTransfers);

    return NextResponse.json({ transfers: sortedTransfers });
  } catch (error: any) {
    console.error('Error in GET handler:', error);
    if (error.response?.status === 401 || error.code === 401 || error.code === 403) {
      return NextResponse.json(
        { error: 'Your session has expired. Please sign in again.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
} 