import { google } from 'googleapis';
import { Tip } from './db';

const DRAFT_SUBJECT = '[GreenViva] Tips Sync';
const DRAFT_LABEL = 'GreenViva/Tips';

export class GmailService {
  private gmail;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  private encodeMessage(message: string): string {
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private decodeMessage(encoded: string): string {
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(encoded, 'base64').toString('utf8');
  }

  private async findSyncDraft(): Promise<string | null> {
    try {
      const response = await this.gmail.users.drafts.list({
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

  private createDraftContent(tips: Tip[]): string {
    const email = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      `Subject: ${DRAFT_SUBJECT}\n`,
      '\n',
      JSON.stringify(tips, null, 2)
    ].join('');

    return this.encodeMessage(email);
  }

  async syncTips(tips: Tip[]): Promise<void> {
    try {
      const draftId = await this.findSyncDraft();
      const draftContent = this.createDraftContent(tips);

      if (draftId) {
        // Update existing draft
        await this.gmail.users.drafts.update({
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
        await this.gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: draftContent
            }
          }
        });
      }
    } catch (error) {
      console.error('Error syncing tips:', error);
      throw new Error('Failed to sync tips with Gmail');
    }
  }

  async loadTips(): Promise<Tip[]> {
    try {
      const draftId = await this.findSyncDraft();
      if (!draftId) {
        return [];
      }

      const response = await this.gmail.users.drafts.get({
        userId: 'me',
        id: draftId,
        format: 'raw'
      });

      const draft = response.data;
      if (!draft.message?.raw) {
        return [];
      }

      const content = this.decodeMessage(draft.message.raw);
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) {
        return [];
      }

      return JSON.parse(match[0]);
    } catch (error) {
      console.error('Error loading tips from Gmail:', error);
      return [];
    }
  }
} 