import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter } from '../types/storage';

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
    return openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('main')) {
          db.createObjectStore('main');
        }
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets');
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

  async clear(): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.clear(this.storeName);
    } catch (error) {
      console.error('IndexedDB clear error:', error);
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
      // For stores with keyPath, just pass the value (the key is extracted from the object)
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
