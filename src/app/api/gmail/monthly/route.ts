import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { format, parse, startOfYear, endOfYear } from 'date-fns';
import { authOptions } from '../../auth/[...nextauth]/auth.config';

const getGmailClient = async (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
};

const parseAmount = (text: string): number | null => {
  // Match amounts in formats like "€2.65" or "2.65€" or "2,65€" or "€2,65"
  const amountMatch = text.match(/[€](\d+[.,]\d+)|(\d+[.,]\d+)[€]/);
  if (!amountMatch) return null;

  // Get the amount part and convert to standard decimal format
  const amount = (amountMatch[1] || amountMatch[2]).replace(',', '.');
  return parseFloat(amount);
};

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const headers = new Headers();
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.email) {
          controller.enqueue('data: ' + JSON.stringify({ error: 'Not authenticated' }) + '\n\n');
          controller.close();
          return;
        }

        const searchParams = request.nextUrl.searchParams;
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

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
        let processedCount = 0;
        const totalCount = messages.length;

        // Send initial progress
        controller.enqueue('data: ' + JSON.stringify({ 
          type: 'progress',
          current: processedCount,
          total: totalCount 
        }) + '\n\n');

        const monthlyTotals: { [key: string]: { totalAmount: number; numberOfTransfers: number } } = {};

        for (const message of messages) {
          processedCount++;
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const body = email.data.payload?.parts?.[0]?.body?.data ||
                      email.data.payload?.body?.data || '';
          const decodedBody = Buffer.from(body, 'base64').toString('utf8');
          const amount = parseAmount(decodedBody);

          const headers = email.data.payload?.headers || [];
          const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date');
          
          if (!dateHeader?.value || !amount) {
            // Send progress even for skipped emails
            controller.enqueue('data: ' + JSON.stringify({ 
              type: 'progress',
              current: processedCount,
              total: totalCount 
            }) + '\n\n');
            continue;
          }

          const emailDate = new Date(dateHeader.value);
          const monthKey = format(emailDate, 'MMMM yyyy');

          if (!monthlyTotals[monthKey]) {
            monthlyTotals[monthKey] = { totalAmount: 0, numberOfTransfers: 0 };
          }

          monthlyTotals[monthKey].totalAmount += amount;
          monthlyTotals[monthKey].numberOfTransfers += 1;

          // Send progress update
          controller.enqueue('data: ' + JSON.stringify({ 
            type: 'progress',
            current: processedCount,
            total: totalCount 
          }) + '\n\n');
        }

        // Convert to array and sort by date
        const monthlyTotalsArray = Object.entries(monthlyTotals).map(([month, data]) => ({
          month,
          ...data
        })).sort((a, b) => {
          const dateA = parse(a.month, 'MMMM yyyy', new Date());
          const dateB = parse(b.month, 'MMMM yyyy', new Date());
          return dateA.getTime() - dateB.getTime();
        });

        // Send final data
        controller.enqueue('data: ' + JSON.stringify({ 
          type: 'data',
          monthlyTotals: monthlyTotalsArray 
        }) + '\n\n');

        controller.close();
      } catch (error) {
        console.error('Error in stream:', error);
        controller.enqueue('data: ' + JSON.stringify({ error: 'Failed to fetch monthly data' }) + '\n\n');
        controller.close();
      }
    }
  });

  return new Response(stream, { headers });
} 