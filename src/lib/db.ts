import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Tip {
  id: string;
  amount: number;
  date: string;
  note?: string;
  synced?: boolean;
}

interface TipsDBSchema extends DBSchema {
  tips: {
    key: string;
    value: Tip;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'greenviva-tips';
const STORE_NAME = 'tips';
const DB_VERSION = 1;

export class TipsDatabase {
  private db: Promise<IDBPDatabase<TipsDBSchema>>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB(): Promise<IDBPDatabase<TipsDBSchema>> {
    return openDB<TipsDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<TipsDBSchema>) {
        // Create the store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
          });
          
          // Create an index on the date field
          store.createIndex('by-date', 'date');
        }
      },
    });
  }

  async addTip(tip: Omit<Tip, 'id' | 'synced'>): Promise<Tip> {
    const db = await this.db;
    const id = crypto.randomUUID();
    const newTip: Tip = {
      ...tip,
      id,
      synced: false,
    };
    
    await db.put(STORE_NAME, newTip);
    return newTip;
  }

  async getTips(): Promise<Tip[]> {
    const db = await this.db;
    return db.getAllFromIndex(STORE_NAME, 'by-date');
  }

  async getTipsByDate(date: string): Promise<Tip[]> {
    const db = await this.db;
    const allTips = await db.getAllFromIndex(STORE_NAME, 'by-date');
    return allTips.filter((tip: Tip) => tip.date.startsWith(date));
  }

  async updateTip(tip: Tip): Promise<void> {
    const db = await this.db;
    await db.put(STORE_NAME, tip);
  }

  async deleteTip(id: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE_NAME, id);
  }

  async getUnsynced(): Promise<Tip[]> {
    const db = await this.db;
    const allTips = await db.getAll(STORE_NAME);
    return allTips.filter((tip: Tip) => !tip.synced);
  }

  async markAsSynced(id: string): Promise<void> {
    const db = await this.db;
    const tip = await db.get(STORE_NAME, id);
    if (tip) {
      tip.synced = true;
      await db.put(STORE_NAME, tip);
    }
  }
} 