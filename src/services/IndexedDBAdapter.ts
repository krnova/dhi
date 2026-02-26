import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter } from '../types/storage';

// All object stores managed by this adapter.
// Keep this in sync with initDB() whenever a new store is added.
const ALL_STORES = ['main', 'notes', 'assets'] as const;

export class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private storeName: string;
  private dbPromise: Promise<IDBPDatabase>;

  constructor(dbName: string = 'dhi_db', storeName: string = 'main') {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbPromise = this.initDB();
  }

  private async initDB(): Promise<IDBPDatabase> {
    return openDB(this.dbName, 2, {  // ← Version bumped to 2
      upgrade(db, oldVersion) {
        // Clean slate - delete old stores if they exist
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('assets')) {
            db.deleteObjectStore('assets');
          }
        }

        // Create stores with correct schema
        if (!db.objectStoreNames.contains('main')) {
          db.createObjectStore('main');
        }

        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('updatedAt', 'updatedAt');
          noteStore.createIndex('folderId', 'folderId');
        }
      },
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;
      const value = await db.get(this.storeName, key);
      return value !== undefined ? (value as T) : null;
    } catch (error) {
      console.error(`IndexedDB get error for key "${key}":`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put(this.storeName, value, key);
    } catch (error) {
      console.error(`IndexedDB set error for key "${key}":`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete(this.storeName, key);
    } catch (error) {
      console.error(`IndexedDB remove error for key "${key}":`, error);
      throw error;
    }
  }

  // FIX #3: The original clear() only wiped the 'main' store, leaving 'notes'
  // and 'assets' intact. This silently broke the round-trip test (import ran
  // on top of existing data instead of a clean slate). This method now clears
  // the instance's designated storeName only — use clearAllStores() for a
  // full wipe (e.g. round-trip testing or factory reset).
  async clear(): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.clear(this.storeName);
    } catch (error) {
      console.error('IndexedDB clear error:', error);
      throw error;
    }
  }

  // FIX #5: New method that clears ALL object stores in the database.
  // Required by the round-trip test spec: "await db.clear(); await storage.clear()"
  // must produce a genuinely empty database before re-importing.
  // Also useful for a future "factory reset" / "wipe all data" feature.
  async clearAllStores(): Promise<void> {
    try {
      const db = await this.dbPromise;
      await Promise.all(ALL_STORES.map(store => db.clear(store)));
    } catch (error) {
      console.error('IndexedDB clearAllStores error:', error);
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.dbPromise;
      return await db.getAllKeys(this.storeName) as string[];
    } catch (error) {
      console.error('IndexedDB keys error:', error);
      return [];
    }
  }

  async getFromStore<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;
      const value = await db.get(storeName, key);
      return value !== undefined ? (value as T) : null;
    } catch (error) {
      console.error(`IndexedDB getFromStore error: ${storeName}/${key}`, error);
      return null;
    }
  }

  async setInStore<T>(storeName: string, value: T): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put(storeName, value);
    } catch (error) {
      console.error(`IndexedDB setInStore error: ${storeName}`, error);
      throw error;
    }
  }

  async getAllFromStore<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.dbPromise;
      return await db.getAll(storeName) as T[];
    } catch (error) {
      console.error(`IndexedDB getAllFromStore error: ${storeName}`, error);
      return [];
    }
  }

  async deleteFromStore(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete(storeName, key);
    } catch (error) {
      console.error(`IndexedDB deleteFromStore error: ${storeName}/${key}`, error);
      throw error;
    }
  }
}
