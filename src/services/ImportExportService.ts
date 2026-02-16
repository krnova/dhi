// Import/Export Service - Data Liberation for DHI
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { Note, Folder, Asset, AppSettings } from '../types/storage';

const db = new IndexedDBAdapter();
const storage = new LocalStorageAdapter();

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportManifest {
  version: string;
  exportDate: string;
  appVersion: string;
  notes: ExportNote[];
  folders: Folder[];
  assets: AssetMetadata[];
  settings: Partial<AppSettings>;
}

export interface ExportNote {
  id: string;
  title: string;
  content: string;
  tags: Array<{ name: string; color: string }>;
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  linkedNotes: string[];
}

export interface AssetMetadata {
  id: string;
  noteId: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  filename: string; // In zip: assets/asset-id.ext
  size: number;
  mimeType: string;
  createdAt: number;
}

export interface ExportProgress {
  stage: 'gathering' | 'compressing' | 'complete';
  percent: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get file extension from MIME type
 */
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
  };
  return map[mimeType] || 'bin';
}

/**
 * Format date for filenames (YYYY-MM-DD)
 */
function formatDateForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Sanitize filename (remove illegal characters)
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Get folder path (for Markdown exports)
 */
function getFolderPath(folderId: string | undefined, folders: Folder[]): string {
  if (!folderId) return '';
  
  const path: string[] = [];
  let current = folders.find(f => f.id === folderId);
  
  while (current) {
    path.unshift(current.name);
    current = folders.find(f => f.id === current!.parentId);
  }
  
  return path.join('/');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: DHI JSON BACKUP (Complete Fidelity)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export complete DHI backup as JSON + assets in a zip file
 * Guarantees ZERO data loss - every field preserved
 * 
 * @param onProgress - Optional progress callback
 * @returns Blob of the zip file
 */
export async function exportFullBackup(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({ stage: 'gathering', percent: 0, message: 'Loading data...' });

    // Gather all data from storage
    const notes = await db.getAllFromStore<Note>('notes');
    const folders = await db.get<Folder[]>('folders') || [];
    const assets = await db.getAllFromStore<Asset>('assets');
    const settings = await storage.get<AppSettings>('settings');

    onProgress?.({ stage: 'gathering', percent: 25, message: `Found ${notes.length} notes, ${assets.length} assets...` });

    // Build manifest with COMPLETE fidelity
    const manifest: ExportManifest = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      appVersion: '0.1.0-alpha',
      
      notes: notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags, // Includes colors!
        folderId: n.folderId,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        linkedNotes: n.linkedNotes,
      })),
      
      folders: folders.map(f => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        createdAt: f.createdAt,
      })),
      
      assets: assets.map(a => ({
        id: a.id,
        noteId: a.noteId,
        type: a.type,
        name: a.name,
        filename: `${a.id}.${getExtension(a.mimeType)}`,
        size: a.size,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
      })),
      
      settings: settings ? {
        theme: settings.theme,
        fontSize: settings.fontSize,
        enableJyotish: settings.enableJyotish,
        defaultView: settings.defaultView,
        editorMode: settings.editorMode,
        location: settings.location,
        tagColorPalette: settings.tagColorPalette,
      } : {},
    };

    onProgress?.({ stage: 'gathering', percent: 50, message: 'Creating archive...' });

    // Create zip archive
    const zip = new JSZip();

    // Add manifest
    zip.file('dhi-backup.json', JSON.stringify(manifest, null, 2));

    onProgress?.({ stage: 'compressing', percent: 60, message: 'Adding assets...' });

    // Add assets (standard approach for v1)
    for (const asset of assets) {
      const ext = getExtension(asset.mimeType);
      zip.file(`assets/${asset.id}.${ext}`, asset.blob);
    }

    onProgress?.({ stage: 'compressing', percent: 80, message: 'Compressing archive...' });

    // Calculate total size to decide on streaming
    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);
    const useStreaming = totalSize > 50 * 1024 * 1024; // 50MB threshold

    console.log(`Export size: ${(totalSize / 1024 / 1024).toFixed(2)}MB, streaming: ${useStreaming}`);

    // Generate zip (adaptive strategy)
    const blob = await zip.generateAsync(
      { 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        streamFiles: useStreaming, // Memory-efficient for large exports
      },
      useStreaming ? (metadata) => {
        const percent = Math.floor(80 + (metadata.percent * 0.2));
        onProgress?.({ stage: 'compressing', percent, message: `Compressing... ${metadata.percent.toFixed(0)}%` });
      } : undefined
    );

    onProgress?.({ stage: 'complete', percent: 100, message: 'Export complete!' });

    return blob;
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download DHI backup to user's device
 */
export async function downloadFullBackup(
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  const blob = await exportFullBackup(onProgress);
  const filename = `dhi-backup-${formatDateForFilename()}.zip`;
  saveAs(blob, filename);
  
  // Store last backup timestamp
  await storage.set('lastBackupDate', Date.now());
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: MARKDOWN ARCHIVE (Human-readable, portable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export notes as Markdown files with frontmatter
 * Includes complete metadata in frontmatter for round-trip compatibility
 * 
 * @param onProgress - Optional progress callback
 * @returns Blob of the zip file
 */
export async function exportMarkdownArchive(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({ stage: 'gathering', percent: 0, message: 'Loading notes...' });

    const notes = await db.getAllFromStore<Note>('notes');
    const folders = await db.get<Folder[]>('folders') || [];
    const assets = await db.getAllFromStore<Asset>('assets');

    onProgress?.({ stage: 'gathering', percent: 25, message: `Processing ${notes.length} notes...` });

    const zip = new JSZip();
    const assetsFolder = zip.folder('assets')!;

    // Process each note
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const percent = 25 + Math.floor((i / notes.length) * 50);
      onProgress?.({ stage: 'gathering', percent, message: `Processing "${note.title}"...` });

      // Build frontmatter with COMPLETE metadata
      const folderPath = getFolderPath(note.folderId, folders);
      const frontmatter = [
        '---',
        `id: ${note.id}`,
        `title: ${note.title}`,
        `created: ${new Date(note.createdAt).toISOString()}`,
        `updated: ${new Date(note.updatedAt).toISOString()}`,
      ];

      // Tags with colors (CRITICAL for preservation)
      if (note.tags.length > 0) {
        frontmatter.push('tags:');
        note.tags.forEach(tag => {
          frontmatter.push(`  - name: ${tag.name}`);
          frontmatter.push(`    color: "${tag.color}"`);
        });
      }

      // Folder information
      if (note.folderId) {
        frontmatter.push(`folder: ${folderPath}`);
        frontmatter.push(`folderId: ${note.folderId}`);
      }

      // Linked notes
      if (note.linkedNotes.length > 0) {
        frontmatter.push('linkedNotes:');
        note.linkedNotes.forEach(id => {
          frontmatter.push(`  - ${id}`);
        });
      }

      frontmatter.push('---', '', note.content);

      // Determine file path (with folder structure)
      const sanitizedTitle = sanitizeFilename(note.title);
      const filePath = folderPath 
        ? `${folderPath}/${sanitizedTitle}.md`
        : `${sanitizedTitle}.md`;

      zip.file(filePath, frontmatter.join('\n'));
    }

    onProgress?.({ stage: 'compressing', percent: 75, message: 'Adding assets...' });

    // Add all assets to assets/ folder
    for (const asset of assets) {
      const ext = getExtension(asset.mimeType);
      assetsFolder.file(`${asset.id}.${ext}`, asset.blob);
    }

    onProgress?.({ stage: 'compressing', percent: 90, message: 'Creating archive...' });

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    onProgress?.({ stage: 'complete', percent: 100, message: 'Export complete!' });

    return blob;
  } catch (error) {
    console.error('Markdown export failed:', error);
    throw new Error(`Markdown export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download Markdown archive to user's device
 */
export async function downloadMarkdownArchive(
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  const blob = await exportMarkdownArchive(onProgress);
  const filename = `dhi-notes-${formatDateForFilename()}.zip`;
  saveAs(blob, filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: SINGLE NOTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export a single note as Markdown with complete frontmatter
 * If note has images, creates a mini-zip with assets folder
 * 
 * @param noteId - ID of the note to export
 * @returns Blob of either .md file or .zip (if has assets)
 */
export async function exportSingleNote(noteId: string): Promise<{ blob: Blob; filename: string }> {
  try {
    const note = await db.getFromStore<Note>('notes', noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const folders = await db.get<Folder[]>('folders') || [];
    const allAssets = await db.getAllFromStore<Asset>('assets');
    
    // Find assets referenced by this note
    const noteAssets = allAssets.filter(a => a.noteId === noteId);

    // Build frontmatter
    const folderPath = getFolderPath(note.folderId, folders);
    const frontmatter = [
      '---',
      `id: ${note.id}`,
      `title: ${note.title}`,
      `created: ${new Date(note.createdAt).toISOString()}`,
      `updated: ${new Date(note.updatedAt).toISOString()}`,
    ];

    if (note.tags.length > 0) {
      frontmatter.push('tags:');
      note.tags.forEach(tag => {
        frontmatter.push(`  - name: ${tag.name}`);
        frontmatter.push(`    color: "${tag.color}"`);
      });
    }

    if (note.folderId) {
      frontmatter.push(`folder: ${folderPath}`);
      frontmatter.push(`folderId: ${note.folderId}`);
    }

    if (note.linkedNotes.length > 0) {
      frontmatter.push('linkedNotes:');
      note.linkedNotes.forEach(id => {
        frontmatter.push(`  - ${id}`);
      });
    }

    frontmatter.push('---', '', note.content);
    const markdownContent = frontmatter.join('\n');

    const sanitizedTitle = sanitizeFilename(note.title);

    // If no assets, return simple .md file
    if (noteAssets.length === 0) {
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      return { blob, filename: `${sanitizedTitle}.md` };
    }

    // If has assets, create mini-zip
    const zip = new JSZip();
    zip.file(`${sanitizedTitle}.md`, markdownContent);

    const assetsFolder = zip.folder('assets')!;
    for (const asset of noteAssets) {
      const ext = getExtension(asset.mimeType);
      assetsFolder.file(`${asset.id}.${ext}`, asset.blob);
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return { blob, filename: `${sanitizedTitle}.zip` };
  } catch (error) {
    console.error('Single note export failed:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download single note to user's device
 */
export async function downloadSingleNote(noteId: string): Promise<void> {
  const { blob, filename } = await exportSingleNote(noteId);
  saveAs(blob, filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES: Last Backup Tracking
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get last backup timestamp
 */
export async function getLastBackupDate(): Promise<number | null> {
  return await storage.get<number>('lastBackupDate');
}

/**
 * Get human-readable last backup time
 */
export async function getLastBackupMessage(): Promise<string> {
  const lastBackup = await getLastBackupDate();
  
  if (!lastBackup) {
    return 'Never';
  }

  const now = Date.now();
  const diff = now - lastBackup;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Check if backup is recommended (>7 days)
 */
export async function shouldRecommendBackup(): Promise<boolean> {
  const lastBackup = await getLastBackupDate();
  
  if (!lastBackup) {
    return true; // Never backed up
  }

  const daysSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
  return daysSinceBackup > 7;
}
