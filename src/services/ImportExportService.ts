// Import/Export Service - Data Liberation for DHI
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as yaml from 'js-yaml';
import { extractLinkedNoteIds } from '../utils/wikiLinks';
import { Capacitor } from '@capacitor/core';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { Note, Folder, Asset, AppSettings, ExportManifest, AssetMetadata, ImportPlan, ImportConflict, ImportWarning, Tag } from '../types/storage';

const db = new IndexedDBAdapter();
const storage = new LocalStorageAdapter();

// Platform detection
const isNativePlatform = Capacitor.isNativePlatform();

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

/**
 * Save file to device (platform-aware)
 * Uses Capacitor Filesystem on native, file-saver on web
 */
async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isNativePlatform) {
    // Native platform (Android/iOS) - use Capacitor Filesystem
    try {
      // Convert Blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Write to Downloads directory
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents, // Falls back to accessible location
        recursive: true,
      });

      console.log(`File saved to Documents/${filename}`);
    } catch (error) {
      console.error('Capacitor file save failed:', error);
      throw new Error(`Failed to save file on device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Web platform - use file-saver
    saveAs(blob, filename);
  }
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
    const folders = await db.get<Folder[]>('folders') || []; // Fixed: Use IndexedDB, not LocalStorage
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
  
  await saveFile(blob, filename);
  
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
    const folders = await db.get<Folder[]>('folders') || []; // Fixed: Use IndexedDB
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
  await saveFile(blob, filename);
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

    const folders = await db.get<Folder[]>('folders') || []; // Fixed: Use IndexedDB
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
  await saveFile(blob, filename);
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

/**
 * Parse imported file and detect format
 */
export async function parseImportFile(file: File): Promise<ImportPlan> {
  try {
    // Check if it's a zip file
    if (file.name.endsWith('.zip')) {
      return await parseZipImport(file);
    }
    
    // Check if it's a JSON file
    if (file.name.endsWith('.json')) {
      return await parseJSONImport(file);
    }
    
    // Assume it's a Markdown file
    if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      return await parseMarkdownImport(file);
    }
    
    throw new Error('Unsupported file format. Please upload .zip, .json, or .md files.');
    
  } catch (error) {
    console.error('Import parsing failed:', error);
    throw new Error(`Failed to parse import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse DHI JSON backup (zip or standalone JSON)
 */
async function parseZipImport(file: File): Promise<ImportPlan> {
  const zip = await JSZip.loadAsync(file);
  
  // Try to find manifest
  const manifestFile = zip.file('dhi-backup.json');
  if (!manifestFile) {
    // Not a DHI backup, try as Markdown archive
    return await parseMarkdownArchiveFromZip(zip);
  }
  
  const manifestText = await manifestFile.async('text');
  const manifest: ExportManifest = JSON.parse(manifestText);
  
  // Validate structure
  if (!manifest.version || !Array.isArray(manifest.notes)) {
    throw new Error('Invalid DHI backup format');
  }
  
  // Extract assets from zip
  const assets: { id: string; blob: Blob; metadata: AssetMetadata }[] = [];
  const assetsFolder = zip.folder('assets');
  
  if (assetsFolder) {
    for (const [filename, zipEntry] of Object.entries(assetsFolder.files)) {
      if (!zipEntry.dir) {
        const blob = await zipEntry.async('blob');
        const assetId = filename.split('/').pop()!.split('.')[0]; // Extract ID from filename
        
        const metadata = manifest.assets.find(a => a.id === assetId);
        if (metadata) {
          assets.push({ id: assetId, blob, metadata });
        }
      }
    }
  }
  
  // Check for missing assets
  const warnings: ImportWarning[] = [];
  for (const assetMeta of manifest.assets) {
    const found = assets.some(a => a.id === assetMeta.id);
    if (!found) {
      warnings.push({
        type: 'missing_asset',
        message: `Image "${assetMeta.name}" not found in backup`,
        affectedNoteId: assetMeta.noteId,
      });
    }
  }
  
  // Detect conflicts
  const existingNotes = await db.getAllFromStore<Note>('notes');
  const existingFolders = await db.get<Folder[]>('folders') || [];
  const existingAssets = await db.getAllFromStore<Asset>('assets');
  
  const conflicts = await detectCollisions(
    existingNotes,
    existingFolders,
    existingAssets,
    manifest.notes,
    manifest.folders,
    assets.map(a => a.metadata)
  );
  
  // Calculate total size
  const totalSize = assets.reduce((sum, a) => sum + a.blob.size, 0);
  
  return {
    notes: manifest.notes,
    folders: manifest.folders,
    assets,
    conflicts,
    warnings,
    source: 'dhi-json',
    totalSize,
    containsSettings: !!manifest.settings,
    settings: manifest.settings,
  };
}

/**
 * Parse standalone DHI JSON file
 */
async function parseJSONImport(file: File): Promise<ImportPlan> {
  const text = await file.text();
  const manifest: ExportManifest = JSON.parse(text);
  
  // Validate structure
  if (!manifest.version || !Array.isArray(manifest.notes)) {
    throw new Error('Invalid DHI backup format');
  }
  
  // No assets in standalone JSON
  const warnings: ImportWarning[] = manifest.assets.map(a => ({
    type: 'missing_asset' as const,
    message: `Image "${a.name}" not included (standalone JSON has no assets)`,
    affectedNoteId: a.noteId,
  }));
  
  // Detect conflicts
  const existingNotes = await db.getAllFromStore<Note>('notes');
  const existingFolders = await db.get<Folder[]>('folders') || [];
  const existingAssets = await db.getAllFromStore<Asset>('assets');
  
  const conflicts = await detectCollisions(
    existingNotes,
    existingFolders,
    existingAssets,
    manifest.notes,
    manifest.folders,
    []
  );
  
  return {
    notes: manifest.notes,
    folders: manifest.folders,
    assets: [],
    conflicts,
    warnings,
    source: 'dhi-json',
    totalSize: 0,
    containsSettings: !!manifest.settings,
    settings: manifest.settings,
  };
}

/**
 * Parse DHI Markdown archive from zip
 */
async function parseMarkdownArchiveFromZip(zip: JSZip): Promise<ImportPlan> {
  const notes: Note[] = [];
  const folders: Folder[] = [];
  const assets: { id: string; blob: Blob; metadata: AssetMetadata }[] = [];
  const warnings: ImportWarning[] = [];
  
  // Extract assets first
  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    for (const [filename, zipEntry] of Object.entries(assetsFolder.files)) {
      if (!zipEntry.dir) {
        const blob = await zipEntry.async('blob');
        const assetId = filename.split('/').pop()!.split('.')[0];
        const ext = filename.split('.').pop() || 'bin';
        
        assets.push({
          id: assetId,
          blob,
          metadata: {
            id: assetId,
            noteId: '', // Will be set when processing notes
            type: 'image',
            name: filename,
            filename,
            size: blob.size,
            mimeType: getMimeTypeFromExtension(ext),
            createdAt: Date.now(),
          },
        });
      }
    }
  }
  
  // Process markdown files
  const folderPathMap = new Map<string, string>(); // path -> folderId
  
  for (const [filepath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir || !filepath.endsWith('.md') || filepath.startsWith('assets/')) {
      continue;
    }
    
    const content = await zipEntry.async('text');
    
    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      warnings.push({
        type: 'malformed_frontmatter',
        message: `No frontmatter found in "${filepath}"`,
      });
      continue;
    }
    
    const frontmatter = yaml.load(frontmatterMatch[1]) as any;
    const noteContent = frontmatterMatch[2];
    
    // Extract folder from filepath
    const pathParts = filepath.split('/');
    const filename = pathParts.pop()!;
    const folderPath = pathParts.join('/');
    
    let folderId: string | undefined;
    if (folderPath) {
      // Create folder hierarchy if needed
      if (!folderPathMap.has(folderPath)) {
        const newFolderId = frontmatter.folderId || generateId();
        folders.push({
          id: newFolderId,
          name: pathParts[pathParts.length - 1],
          parentId: undefined, // TODO: Handle nested folders
          createdAt: Date.now(),
        });
        folderPathMap.set(folderPath, newFolderId);
      }
      folderId = folderPathMap.get(folderPath);
    }
    
    // Parse tags
    const tags: Tag[] = [];
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        for (const tag of frontmatter.tags) {
          if (typeof tag === 'object' && tag.name) {
            // DHI format with colors
            tags.push({ name: tag.name, color: tag.color || getNextColorForImport() });
          } else if (typeof tag === 'string') {
            // Simple string format
            tags.push({ name: tag, color: getNextColorForImport() });
          }
        }
      }
    }
    
    // Create note
    const note: Note = {
      id: frontmatter.id || generateId(),
      title: frontmatter.title || filename.replace('.md', ''),
      content: noteContent,
      tags,
      folderId,
      createdAt: frontmatter.created ? new Date(frontmatter.created).getTime() : Date.now(),
      updatedAt: frontmatter.updated ? new Date(frontmatter.updated).getTime() : Date.now(),
      linkedNotes: frontmatter.linkedNotes || extractLinkedNoteIds(noteContent),
    };
    
    notes.push(note);
  }
  
  // Update asset noteId references
  for (const asset of assets) {
    const note = notes.find(n => n.content.includes(`dhi-asset://${asset.id}`));
    if (note) {
      asset.metadata.noteId = note.id;
    }
  }
  
  // Detect conflicts
  const existingNotes = await db.getAllFromStore<Note>('notes');
  const existingFolders = await db.get<Folder[]>('folders') || [];
  const existingAssets = await db.getAllFromStore<Asset>('assets');
  
  const conflicts = await detectCollisions(
    existingNotes,
    existingFolders,
    existingAssets,
    notes,
    folders,
    assets.map(a => a.metadata)
  );
  
  const totalSize = assets.reduce((sum, a) => sum + a.blob.size, 0);
  
  return {
    notes,
    folders,
    assets,
    conflicts,
    warnings,
    source: 'dhi-markdown',
    totalSize,
    containsSettings: false,
  };
}

/**
 * Parse single Markdown file
 */
async function parseMarkdownImport(file: File): Promise<ImportPlan> {
  const content = await file.text();
  const warnings: ImportWarning[] = [];
  
  // Try to parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  let frontmatter: any = {};
  let noteContent = content;
  
  if (frontmatterMatch) {
    try {
      frontmatter = yaml.load(frontmatterMatch[1]) as any;
      noteContent = frontmatterMatch[2];
    } catch (error) {
      warnings.push({
        type: 'malformed_frontmatter',
        message: 'Could not parse frontmatter, using defaults',
      });
    }
  }
  
  // Parse tags
  const tags: Tag[] = [];
  if (frontmatter.tags) {
    if (Array.isArray(frontmatter.tags)) {
      for (const tag of frontmatter.tags) {
        if (typeof tag === 'object' && tag.name) {
          tags.push({ name: tag.name, color: tag.color || getNextColorForImport() });
        } else if (typeof tag === 'string') {
          tags.push({ name: tag, color: getNextColorForImport() });
        }
      }
    }
  }
  
  // Create note
  const note: Note = {
    id: frontmatter.id || generateId(),
    title: frontmatter.title || file.name.replace(/\.(md|txt)$/, ''),
    content: noteContent,
    tags,
    folderId: frontmatter.folderId,
    createdAt: frontmatter.created ? new Date(frontmatter.created).getTime() : Date.now(),
    updatedAt: frontmatter.updated ? new Date(frontmatter.updated).getTime() : Date.now(),
    linkedNotes: frontmatter.linkedNotes || extractLinkedNoteIds(noteContent),
  };
  
  // Detect conflicts
  const existingNotes = await db.getAllFromStore<Note>('notes');
  const existingFolders = await db.get<Folder[]>('folders') || [];
  const existingAssets = await db.getAllFromStore<Asset>('assets');
  
  const conflicts = await detectCollisions(
    existingNotes,
    existingFolders,
    existingAssets,
    [note],
    [],
    []
  );
  
  return {
    notes: [note],
    folders: [],
    assets: [],
    conflicts,
    warnings,
    source: 'external-markdown',
    totalSize: 0,
    containsSettings: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLISION DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect ID collisions and build conflict list
 */
async function detectCollisions(
  existingNotes: Note[],
  existingFolders: Folder[],
  existingAssets: Asset[],
  importedNotes: Note[],
  importedFolders: Folder[],
  importedAssets: AssetMetadata[]
): Promise<ImportConflict[]> {
  
  const conflicts: ImportConflict[] = [];
  
  // Check note collisions
  for (const note of importedNotes) {
    const existing = existingNotes.find(n => n.id === note.id);
    if (existing) {
      // Collision detected - check if content matches
      if (existing.content === note.content && existing.title === note.title) {
        // Same note - skip
        conflicts.push({
          type: 'note',
          oldId: note.id,
          title: note.title,
          action: 'skip',
          reason: 'Note already exists with identical content',
        });
      } else {
        // Different note - regenerate
        conflicts.push({
          type: 'note',
          oldId: note.id,
          newId: generateId(),
          title: note.title,
          action: 'regenerate',
          reason: 'Note ID collision with different content',
        });
      }
    }
  }
  
  // Check folder collisions
  for (const folder of importedFolders) {
    const existing = existingFolders.find(f => f.id === folder.id);
    if (existing) {
      conflicts.push({
        type: 'folder',
        oldId: folder.id,
        newId: generateId(),
        title: folder.name,
        action: 'regenerate',
        reason: 'Folder ID collision',
      });
    }
  }
  
  // Check asset collisions
  for (const asset of importedAssets) {
    const existing = existingAssets.find(a => a.id === asset.id);
    if (existing) {
      conflicts.push({
        type: 'asset',
        oldId: asset.id,
        newId: generateAssetId(),
        title: asset.name,
        action: 'regenerate',
        reason: 'Asset ID collision',
      });
    }
  }
  
  return conflicts;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate asset ID (same format as notes)
 */
function generateAssetId(): string {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 3);
  return `asset-${date}-${time}-${random}`;
}

/**
 * Generate note/folder ID (reuse existing function)
 */
function generateId(): string {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 3);
  return `note-${date}-${time}-${random}`;
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get next color from palette for imported tags
 */
function getNextColorForImport(): string {
  const DEFAULT_TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  ];
  const index = Math.floor(Math.random() * DEFAULT_TAG_COLORS.length);
  return DEFAULT_TAG_COLORS[index];
}

/**
 * Apply ID remapping to notes (update wiki links and asset references)
 */
function remapNoteReferences(
  notes: Note[],
  idMappings: Map<string, string>
): Note[] {
  return notes.map(note => {
    let content = note.content;
    
    // Update wiki links: [[old-id|text]] → [[new-id|text]]
    idMappings.forEach((newId, oldId) => {
      const regex = new RegExp(
        `\\[\\[${escapeRegex(oldId)}(\\|[^\\]]+)?\\]\\]`,
        'g'
      );
      content = content.replace(regex, `[[${newId}$1]]`);
    });
    
    // Update asset references: dhi-asset://old-id → dhi-asset://new-id
    idMappings.forEach((newId, oldId) => {
      if (oldId.startsWith('asset-')) {
        content = content.replace(
          new RegExp(`dhi-asset://${escapeRegex(oldId)}`, 'g'),
          `dhi-asset://${newId}`
        );
      }
    });
    
    // Recompute linkedNotes
    const linkedNotes = extractLinkedNoteIds(content);
    
    return { ...note, content, linkedNotes };
  });
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Topological sort folders (parents before children)
 */
function topologicalSortFolders(folders: Folder[]): Folder[] {
  const sorted: Folder[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(folder: Folder) {
    if (visited.has(folder.id)) return;
    if (visiting.has(folder.id)) {
      console.warn(`Circular dependency in folder: ${folder.id}`);
      return;
    }
    
    visiting.add(folder.id);
    
    // Visit parent first
    if (folder.parentId) {
      const parent = folders.find(f => f.id === folder.parentId);
      if (parent) visit(parent);
    }
    
    visiting.delete(folder.id);
    visited.add(folder.id);
    sorted.push(folder);
  }
  
  // Visit all folders
  folders.forEach(visit);
  
  return sorted;
}

/**
 * Execute import based on plan
 */
export async function executeImport(
  plan: ImportPlan,
  restoreSettings: boolean = false
): Promise<ImportResult> {
  
  const result: ImportResult = {
    success: false,
    notesImported: 0,
    notesSkipped: 0,
    notesRegenerated: 0,
    foldersCreated: 0,
    assetsImported: 0,
    conflicts: plan.conflicts,
    warnings: plan.warnings,
    errors: [],
    settingsRestored: false,
  };
  
  try {
    // Build ID mapping from conflicts
    const idMappings = new Map<string, string>();
    for (const conflict of plan.conflicts) {
      if (conflict.action === 'regenerate' && conflict.newId) {
        idMappings.set(conflict.oldId, conflict.newId);
      }
    }
    
    // Apply ID remapping to notes
    let notesToImport = remapNoteReferences(plan.notes, idMappings);
    
    // Apply ID changes to notes themselves
    notesToImport = notesToImport.map(note => {
      const conflict = plan.conflicts.find(c => c.oldId === note.id && c.type === 'note');
      if (conflict?.action === 'regenerate' && conflict.newId) {
        return { ...note, id: conflict.newId };
      }
      return note;
    });
    
    // Apply ID changes to folders
    let foldersToImport = plan.folders.map(folder => {
      const conflict = plan.conflicts.find(c => c.oldId === folder.id && c.type === 'folder');
      if (conflict?.action === 'regenerate' && conflict.newId) {
        // Update folder ID
        const newFolder = { ...folder, id: conflict.newId };
        
        // Update parentId if parent was also regenerated
        if (newFolder.parentId && idMappings.has(newFolder.parentId)) {
          newFolder.parentId = idMappings.get(newFolder.parentId);
        }
        
        return newFolder;
      }
      return folder;
    });
    
    // Update note folder references
    notesToImport = notesToImport.map(note => {
      if (note.folderId && idMappings.has(note.folderId)) {
        return { ...note, folderId: idMappings.get(note.folderId) };
      }
      return note;
    });
    
    // Apply ID changes to assets
    let assetsToImport = plan.assets.map(asset => {
      const conflict = plan.conflicts.find(c => c.oldId === asset.id && c.type === 'asset');
      if (conflict?.action === 'regenerate' && conflict.newId) {
        return {
          ...asset,
          id: conflict.newId,
          metadata: { ...asset.metadata, id: conflict.newId }
        };
      }
      return asset;
    });
    
    // Update asset noteId references if note IDs were regenerated
    assetsToImport = assetsToImport.map(asset => {
      if (idMappings.has(asset.metadata.noteId)) {
        return {
          ...asset,
          metadata: { ...asset.metadata, noteId: idMappings.get(asset.metadata.noteId)! }
        };
      }
      return asset;
    });
    
    // 1. Import folders (topologically sorted)
    const sortedFolders = topologicalSortFolders(foldersToImport);
    const currentFolders = await db.get<Folder[]>('folders') || [];
    
    for (const folder of sortedFolders) {
      const skipConflict = plan.conflicts.find(
        c => c.oldId === folder.id && c.action === 'skip'
      );
      
      if (!skipConflict && !currentFolders.some(f => f.id === folder.id)) {
        currentFolders.push(folder);
        result.foldersCreated++;
      }
    }
    await db.set('folders', currentFolders);
    
    // 2. Import assets
    for (const asset of assetsToImport) {
      const skipConflict = plan.conflicts.find(
        c => c.oldId === asset.id && c.action === 'skip'
      );
      
      if (!skipConflict) {
        await db.setInStore('assets', {
          id: asset.id,
          noteId: asset.metadata.noteId,
          type: asset.metadata.type,
          name: asset.metadata.name,
          blob: asset.blob,
          size: asset.metadata.size,
          mimeType: asset.metadata.mimeType,
          createdAt: asset.metadata.createdAt,
        });
        result.assetsImported++;
      }
    }
    
    // 3. Import notes
    for (const note of notesToImport) {
      const conflict = plan.conflicts.find(c => c.oldId === note.id && c.type === 'note');
      
      if (conflict?.action === 'skip') {
        result.notesSkipped++;
      } else if (conflict?.action === 'regenerate') {
        await db.setInStore('notes', note);
        result.notesRegenerated++;
      } else {
        await db.setInStore('notes', note);
        result.notesImported++;
      }
    }
    
    // 4. Optional: Restore settings
    if (restoreSettings && plan.containsSettings && plan.settings) {
      const currentSettings = await storage.get<AppSettings>('settings');
      if (currentSettings) {
        await storage.set('settings', {
          ...currentSettings,
          ...plan.settings,
          // Never overwrite onboarding state
          hasCompletedOnboarding: currentSettings.hasCompletedOnboarding,
        });
        result.settingsRestored = true;
      }
    }
    
    result.success = true;
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('Import execution failed:', error);
  }
  
  return result;
}
