import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../../auth/[...nextauth]/auth.config';

const DRAFT_SUBJECT = '[GreenViva] Tips Sync';

interface Tip {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

async function findSyncDraft(gmail: any): Promise<string | null> {
  try {
    const response = await gmail.users.drafts.list({
      userId: 'me',
      q: `subject:"${DRAFT_SUBJECT}"`,
    });

    const drafts = response.data.drafts || [];
    return drafts.length > 0 ? drafts[0].id! : null;
  } catch (error) {
    console.error('Error finding sync draft:', error);
    return null;
  }
}

function createDraftContent(tips: Tip[]): string {
  const email = [
    'Content-Type: text/plain; charset="UTF-8"\n',
    'MIME-Version: 1.0\n',
    `Subject: ${DRAFT_SUBJECT}\n`,
    '\n',
    JSON.stringify(tips, null, 2)
  ].join('');

  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const tips = await request.json();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const draftId = await findSyncDraft(gmail);
    const draftContent = createDraftContent(tips);

    if (draftId) {
      // Update existing draft
      await gmail.users.drafts.update({
        userId: 'me',
        id: draftId,
        requestBody: {
          message: {
            raw: draftContent
          }
        }
      });
    } else {
      // Create new draft
      await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: draftContent
          }
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in sync handler:', error);
    return NextResponse.json(
      { error: 'Failed to sync tips' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: 'v1', auth });

    const draftId = await findSyncDraft(gmail);
    if (!draftId) {
      return NextResponse.json({ tips: [] });
    }

    const response = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'raw'
    });

    const draft = response.data;
    if (!draft.message?.raw) {
      return NextResponse.json({ tips: [] });
    }

    const content = Buffer.from(draft.message.raw, 'base64').toString('utf8');
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ tips: [] });
    }

    const tips = JSON.parse(match[0]);
    return NextResponse.json({ tips });
  } catch (error: any) {
    console.error('Error in sync handler:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tips' },
      { status: 500 }
    );
  }
} 