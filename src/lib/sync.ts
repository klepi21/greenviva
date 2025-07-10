import { TipsDatabase, Tip } from './db';
import { GmailService } from './gmail';

export class SyncService {
  private db: TipsDatabase;
  private gmail: GmailService;
  private syncInProgress = false;

  constructor(accessToken: string) {
    this.db = new TipsDatabase();
    this.gmail = new GmailService(accessToken);
  }

  async initialize(): Promise<void> {
    try {
      // Load tips from Gmail
      const remoteTips = await this.gmail.loadTips();
      
      // Get local tips
      const localTips = await this.db.getTips();
      
      // Merge tips, preferring remote versions
      const mergedTips = this.mergeTips(localTips, remoteTips);
      
      // Update local database
      for (const tip of mergedTips) {
        await this.db.updateTip({ ...tip, synced: true });
      }
    } catch (error) {
      console.error('Error initializing sync:', error);
    }
  }

  private mergeTips(local: Tip[], remote: Tip[]): Tip[] {
    const tipMap = new Map<string, Tip>();
    
    // Add all local tips
    local.forEach(tip => tipMap.set(tip.id, tip));
    
    // Override with remote tips
    remote.forEach(tip => tipMap.set(tip.id, { ...tip, synced: true }));
    
    return Array.from(tipMap.values());
  }

  async sync(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    try {
      this.syncInProgress = true;
      
      // Get all tips from local DB
      const localTips = await this.db.getTips();
      
      // Sync to Gmail
      await this.gmail.syncTips(localTips);
      
      // Mark all as synced
      for (const tip of localTips) {
        if (!tip.synced) {
          await this.db.markAsSynced(tip.id);
        }
      }
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  async addTip(tip: Omit<Tip, 'id' | 'synced'>): Promise<Tip> {
    // Add to local DB
    const newTip = await this.db.addTip(tip);
    
    // Trigger sync
    this.sync().catch(console.error);
    
    return newTip;
  }

  async deleteTip(id: string): Promise<void> {
    // Delete from local DB
    await this.db.deleteTip(id);
    
    // Trigger sync
    this.sync().catch(console.error);
  }

  async getTips(): Promise<Tip[]> {
    return this.db.getTips();
  }

  async getTipsByDate(date: string): Promise<Tip[]> {
    return this.db.getTipsByDate(date);
  }
} 