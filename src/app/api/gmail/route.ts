import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { format, parseISO, startOfDay, endOfDay, addDays } from 'date-fns';
import { authOptions } from '../auth/[...nextauth]/route';

interface Transfer {
  from: string;
  amount: number;
  timestamp: string;
}

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

    const searchParams = new URL(request.url).searchParams;
    const dateParam = searchParams.get('date');
    const date = dateParam ? parseISO(dateParam) : new Date();
    
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    console.log('Search Parameters:', {
      dateParam,
      date: format(date, 'yyyy-MM-dd'),
      dayStart: format(dayStart, 'yyyy-MM-dd'),
      dayEnd: format(dayEnd, 'yyyy-MM-dd')
    });

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ 
      access_token: session.accessToken as string,
      refresh_token: session.refreshToken as string
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Gmail API query using RFC3339 date format
    const query = `from:no-reply@viva.com after:${format(dayStart, 'yyyy/MM/dd')} before:${format(addDays(dayEnd, 1), 'yyyy/MM/dd')}`;
    console.log('Gmail Query:', query);

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
      });

      console.log('Gmail Response:', {
        messagesCount: response.data.messages?.length || 0,
        resultSizeEstimate: response.data.resultSizeEstimate,
      });

      const messages = response.data.messages || [];
      const transfers: Transfer[] = [];

      for (const message of messages) {
        try {
          console.log(`Processing message ID: ${message.id}`);
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const payload = email.data.payload!;
          const headers = payload.headers!;
          const emailDate = headers.find(h => h.name === 'Date')?.value;

          if (!emailDate) {
            console.log(`No date found for message ${message.id}`);
            continue;
          }

          let emailBody = '';
          if (payload.body?.data) {
            emailBody = decodeEmailBody(payload.body.data);
          } else if (payload.parts) {
            // Try to find HTML or plain text part
            const textPart = payload.parts.find(part => 
              part.mimeType === 'text/plain' || part.mimeType === 'text/html'
            );
            if (textPart?.body?.data) {
              emailBody = decodeEmailBody(textPart.body.data);
            }
          }

          console.log('Email Content:', {
            id: message.id,
            date: emailDate,
            bodyLength: emailBody.length,
            bodyPreview: emailBody.substring(0, 200),
            hasAmount: emailBody.includes('Amount') || emailBody.includes('Ποσό'),
            hasFrom: emailBody.includes('From') || emailBody.includes('Από')
          });

          const transfer = parseEmailBody(emailBody);
          if (transfer) {
            transfer.timestamp = emailDate;
            transfers.push(transfer);
            console.log('Found transfer:', transfer);
          } else {
            console.log(`No transfer data found in message ${message.id}`);
          }
        } catch (error: any) {
          if (error.response?.status === 401 || error.code === 401) {
            return NextResponse.json(
              { error: 'Your session has expired. Please sign in again.' },
              { status: 401 }
            );
          }
          if (error.code === 403 || error.response?.status === 403) {
            return NextResponse.json(
              { error: 'Gmail API error: Access denied. Please sign in again.' },
              { status: 401 }
            );
          }
          console.error(`Error processing message ${message.id}:`, error);
          continue;
        }
      }

      console.log('Final transfers:', transfers);

      return NextResponse.json({
        transfers: transfers.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      });
    } catch (error: any) {
      if (error.response?.status === 401 || error.code === 401) {
        return NextResponse.json(
          { error: 'Your session has expired. Please sign in again.' },
          { status: 401 }
        );
      }
      if (error.code === 403 || error.response?.status === 403) {
        return NextResponse.json(
          { error: 'Gmail API error: Access denied. Please sign in again.' },
          { status: 401 }
        );
      }
      console.error('Gmail API error:', error);
      return NextResponse.json(
        { error: 'Gmail API error: Failed to fetch emails. Please sign in again.' },
        { status: 401 }
      );
    }
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