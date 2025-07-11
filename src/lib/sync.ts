import { TipsDatabase, Tip } from './db';

export class SyncService {
  private db: TipsDatabase;
  private syncInProgress = false;

  constructor() {
    this.db = new TipsDatabase();
  }

  async initialize(): Promise<void> {
    try {
      // Load tips from API
      const response = await fetch('/api/tips/sync');
      if (!response.ok) {
        throw new Error('Failed to fetch tips');
      }
      const { tips: remoteTips } = await response.json();
      
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
      
      // Sync to API
      const response = await fetch('/api/tips/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(localTips),
      });

      if (!response.ok) {
        throw new Error('Failed to sync tips');
      }
      
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