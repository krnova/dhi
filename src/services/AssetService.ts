
import { IndexedDBAdapter } from './IndexedDBAdapter';
import type { Asset } from '../types/storage';

const db = new IndexedDBAdapter();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export class AssetService {
  private generateId(): string {
    return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
      console.log('Asset saved to IDB:', asset.id); // Added log
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
    // UPDATED REGEX: Handles both protocols
    const assetRegex = /(?:dhi-asset:\/\/|asset:)([a-z0-9-]+)/g;
    const matches = content.matchAll(assetRegex);
    return Array.from(matches, match => match[1]);
  }

  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const assetService = new AssetService();
