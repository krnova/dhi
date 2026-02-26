import { IndexedDBAdapter } from './IndexedDBAdapter';
import type { Asset } from '../types/storage';

const db = new IndexedDBAdapter();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Shared blob URL cache ────────────────────────────────────────────────────
// Both ImageComponent (Tiptap) and AssetImage (ReactMarkdown preview) resolve
// dhi-asset:// URLs independently. Without a shared cache, each renderer calls
// createObjectURL for the same blob, producing duplicate URLs.
//
// Ref-counting ensures the URL stays alive as long as at least one consumer
// holds it. HOWEVER: during mode switches (e.g. Preview → Edit), the outgoing
// renderer unmounts and releases its ref before the incoming renderer mounts
// and acquires one. This causes refs to momentarily hit 0, evicting the cache
// entry and forcing a brand-new createObjectURL call on every single switch.
//
// Fix: instead of revoking immediately when refs hit 0, schedule revocation
// after a short TTL (EVICTION_DELAY_MS). If any consumer re-acquires the URL
// within that window (as happens during mode switches), the pending eviction is
// cancelled and the URL is reused with zero extra createObjectURL calls.
//
// Split mode (simultaneous consumers) is unaffected — refs stay ≥ 2 the whole
// time both panes are alive, so the TTL path is never reached.

const EVICTION_DELAY_MS = 500;

interface CacheEntry {
  url: string;
  refs: number;
  evictionTimer: ReturnType<typeof setTimeout> | null;
}

const blobUrlCache = new Map<string, CacheEntry>();

// ─────────────────────────────────────────────────────────────────────────────

export class AssetService {
  private generateId(): string {
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
    const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    return `asset-${date}-${time}-${unique}`;
  }

  async uploadImage(file: File, noteId: string): Promise<Asset> {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`Image must be smaller than 5MB (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    const asset: Asset = {
      id: this.generateId(),
      noteId,
      type: 'image',
      name: file.name,
      blob: file,
      size: file.size,
      mimeType: file.type,
      createdAt: Date.now(),
    };

    try {
      await db.setInStore('assets', asset);
      console.log('Asset saved to IDB:', asset.id);
      return asset;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw new Error('Failed to save image');
    }
  }

  async getAsset(assetId: string): Promise<Asset | null> {
    try {
      return await db.getFromStore<Asset>('assets', assetId);
    } catch (error) {
      console.error(`Failed to get asset ${assetId}:`, error);
      return null;
    }
  }

  async deleteAsset(assetId: string): Promise<void> {
    try {
      // If a cache entry exists for this asset, evict it immediately rather
      // than waiting for the TTL — the blob is being intentionally deleted.
      this._evictNow(assetId);
      await db.deleteFromStore('assets', assetId);
    } catch (error) {
      console.error(`Failed to delete asset ${assetId}:`, error);
      throw error;
    }
  }

  async deleteNoteAssets(noteId: string): Promise<void> {
    try {
      const assets = await this.listNoteAssets(noteId);
      await Promise.all(assets.map(asset => this.deleteAsset(asset.id)));
    } catch (error) {
      console.error(`Failed to delete assets for note ${noteId}:`, error);
      throw error;
    }
  }

  async listNoteAssets(noteId: string): Promise<Asset[]> {
    try {
      const allAssets = await db.getAllFromStore<Asset>('assets');
      return allAssets.filter(asset => asset.noteId === noteId);
    } catch (error) {
      console.error(`Failed to list assets for note ${noteId}:`, error);
      return [];
    }
  }

  async getOrphanedAssets(noteContent: string, noteId: string): Promise<Asset[]> {
    try {
      const noteAssets = await this.listNoteAssets(noteId);
      const usedAssetIds = this.extractAssetIdsFromContent(noteContent);
      return noteAssets.filter(asset => !usedAssetIds.includes(asset.id));
    } catch (error) {
      console.error('Failed to find orphaned assets:', error);
      return [];
    }
  }

  async deleteOrphanedAssets(noteContent: string, noteId: string): Promise<number> {
    try {
      const orphaned = await this.getOrphanedAssets(noteContent, noteId);
      if (orphaned.length > 0) {
        console.log('Deleting orphaned assets:', orphaned.map(a => a.id));
        await Promise.all(orphaned.map(asset => this.deleteAsset(asset.id)));
      }
      return orphaned.length;
    } catch (error) {
      console.error('Failed to delete orphaned assets:', error);
      return 0;
    }
  }

  extractAssetIdsFromContent(content: string): string[] {
    const assetRegex = /(?:dhi-asset:\/\/|asset:)([a-z0-9-]+)/g;
    const matches = content.matchAll(assetRegex);
    return Array.from(matches, match => match[1]);
  }

  // ─── Ref-counted blob URL cache with TTL eviction ────────────────────────

  // Acquire a blob URL for the given assetId.
  // - If a live entry exists (refs > 0): increment refs, cancel any pending
  //   eviction timer, return the existing URL. Zero new createObjectURL calls.
  // - If an entry is in the eviction grace period (refs === 0, timer pending):
  //   cancel the timer, restore refs to 1, return the same URL. This is the
  //   key path that eliminates redundant creates during mode switches.
  // - If no entry exists: create a new blob URL and cache it with refs = 1.
  acquireObjectURL(assetId: string, blob: Blob): string {
    const existing = blobUrlCache.get(assetId);
    if (existing) {
      // Cancel any pending eviction — this URL is being reused
      if (existing.evictionTimer !== null) {
        clearTimeout(existing.evictionTimer);
        existing.evictionTimer = null;
      }
      existing.refs++;
      return existing.url;
    }

    const url = URL.createObjectURL(blob);
    blobUrlCache.set(assetId, { url, refs: 1, evictionTimer: null });
    return url;
  }

  // Release the blob URL for the given assetId.
  // Decrements refs. When refs reach 0, schedules revocation after
  // EVICTION_DELAY_MS rather than revoking immediately. This gives the
  // incoming renderer (mounting during a mode switch) time to call
  // acquireObjectURL and cancel the eviction before it fires.
  releaseObjectURL(assetId: string): void {
    const entry = blobUrlCache.get(assetId);
    if (!entry) return;

    entry.refs--;

    if (entry.refs <= 0) {
      // Schedule deferred eviction instead of revoking immediately
      entry.evictionTimer = setTimeout(() => {
        URL.revokeObjectURL(entry.url);
        blobUrlCache.delete(assetId);
      }, EVICTION_DELAY_MS);
    }
  }

  // Force-evict a cache entry immediately, bypassing the TTL.
  // Used when an asset is explicitly deleted from IndexedDB so we don't
  // keep a blob URL alive for data that no longer exists.
  private _evictNow(assetId: string): void {
    const entry = blobUrlCache.get(assetId);
    if (!entry) return;
    if (entry.evictionTimer !== null) {
      clearTimeout(entry.evictionTimer);
    }
    URL.revokeObjectURL(entry.url);
    blobUrlCache.delete(assetId);
  }

  // Legacy methods kept for any external callers.
  // Image components should use acquireObjectURL / releaseObjectURL instead.
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const assetService = new AssetService();
