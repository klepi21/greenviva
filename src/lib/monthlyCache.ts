import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface MonthlyTotal {
  month: string;
  totalAmount: number;
  numberOfTransfers: number;
}

interface CacheEntry {
  key: string;
  data: MonthlyTotal[];
  timestamp: number;
  expiresAt: number;
}

interface CacheDBSchema extends DBSchema {
  cache: {
    key: string;
    value: CacheEntry;
    indexes: { 'by-expiry': number };
  };
}

const DB_NAME = 'greenviva-monthly-cache';
const STORE_NAME = 'cache';
const DB_VERSION = 1;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class MonthlyCacheService {
  private db: Promise<IDBPDatabase<CacheDBSchema>>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB(): Promise<IDBPDatabase<CacheDBSchema>> {
    return openDB<CacheDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<CacheDBSchema>) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'key',
          });
          store.createIndex('by-expiry', 'expiresAt');
        }
      },
    });
  }

  async get(key: string): Promise<MonthlyTotal[] | null> {
    const db = await this.db;
    const entry = await db.get(STORE_NAME, key);
    
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) {
        // Remove expired entry
        await this.delete(key);
      }
      return null;
    }
    
    return entry.data;
  }

  async set(key: string, data: MonthlyTotal[]): Promise<void> {
    const db = await this.db;
    const now = Date.now();
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      expiresAt: now + CACHE_TTL,
    };
    
    await db.put(STORE_NAME, entry);
  }

  async delete(key: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE_NAME, key);
  }

  async clearExpired(): Promise<void> {
    const db = await this.db;
    const now = Date.now();
    
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.store;
    const expiredEntries = await store.index('by-expiry').getAllKeys(IDBKeyRange.upperBound(now));
    
    await Promise.all(expiredEntries.map(key => store.delete(key)));
    await tx.done;
  }
} 