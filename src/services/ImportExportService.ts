// Import/Export Service - Data Liberation for DHI
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as yaml from 'js-yaml';
import { extractLinkedNoteIds } from '../utils/wikiLinks';
import { Capacitor } from '@capacitor/core';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { Note, Folder, Asset, AppSettings, ImportPlan, ImportConflict, ImportWarning, ImportResult, Tag } from '../types/storage';

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

/**
 * Real-time progress state emitted by executeImport via onProgress callback.
 * Shape matches ImportProgressState in ImportProgressModal so DataManagementSection
 * can pass it directly to setImportProgress without any adaptation.
 */
export interface ImportProgressCallback {
  stage: 'folders' | 'assets' | 'notes' | 'finalizing';
  current: number;
  total: number;
  notesImported: number;
  foldersCreated: number;
  assetsImported: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSET VALIDATION GUARDS
// ═══════════════════════════════════════════════════════════════════════════

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

const VALID_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

function isValidImageMime(mimeType: string): boolean {
  return VALID_IMAGE_MIMES.has(mimeType.toLowerCase());
}

export async function purgeCorruptedAssets(): Promise<number> {
  try {
    const allAssets = await db.getAllFromStore<Asset>('assets');
    let purged = 0;
    for (const asset of allAssets) {
      if (!isValidImageMime(asset.mimeType)) {
        await db.deleteFromStore('assets', asset.id);
        purged++;
        console.warn(`Purged corrupted asset: ${asset.id} (mimeType: ${asset.mimeType})`);
      }
    }
    return purged;
  } catch (error) {
    console.error('Failed to purge corrupted assets:', error);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

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

function formatDateForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

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

async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (isNativePlatform) {
    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      console.log(`File saved to Documents/${filename}`);
    } catch (error) {
      console.error('Capacitor file save failed:', error);
      throw new Error(`Failed to save file on device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    saveAs(blob, filename);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateAssetId(): string {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `asset-${date}-${time}-${unique}`;
}

function generateId(): string {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const unique = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `note-${date}-${time}-${unique}`;
}

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

function getNextColorForImport(): string {
  const DEFAULT_TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
  ];
  const index = Math.floor(Math.random() * DEFAULT_TAG_COLORS.length);
  return DEFAULT_TAG_COLORS[index];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: DHI JSON BACKUP (Complete Fidelity)
// ═══════════════════════════════════════════════════════════════════════════

export async function exportFullBackup(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({ stage: 'gathering', percent: 0, message: 'Loading data...' });

    const notes = await db.getAllFromStore<Note>('notes');
    const folders = await db.get<Folder[]>('folders') || [];
    const allAssets = await db.getAllFromStore<Asset>('assets');
    const assets = allAssets.filter(a => isValidImageMime(a.mimeType));

    if (allAssets.length !== assets.length) {
      console.warn(`Skipped ${allAssets.length - assets.length} non-image asset(s) during export`);
    }

    const settings = await storage.get<AppSettings>('settings');

    onProgress?.({ stage: 'gathering', percent: 25, message: `Found ${notes.length} notes, ${assets.length} assets...` });

    const manifest: ExportManifest = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      appVersion: '0.2.0-alpha',

      notes: notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tags: n.tags,
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

    const zip = new JSZip();
    zip.file('dhi-backup.json', JSON.stringify(manifest, null, 2));

    onProgress?.({ stage: 'compressing', percent: 60, message: 'Adding assets...' });

    const assetsFolder = zip.folder('assets')!;
    for (const asset of assets) {
      const ext = getExtension(asset.mimeType);
      assetsFolder.file(`${asset.id}.${ext}`, asset.blob);
    }

    onProgress?.({ stage: 'compressing', percent: 80, message: 'Compressing archive...' });

    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);
    const useStreaming = totalSize > 50 * 1024 * 1024;

    console.log(`Export size: ${(totalSize / 1024 / 1024).toFixed(2)}MB, streaming: ${useStreaming}`);

    const blob = await zip.generateAsync(
      {
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
        streamFiles: useStreaming,
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

export async function downloadFullBackup(
  onProgress?: (progress: ExportProgress) => void
): Promise<void> {
  const blob = await exportFullBackup(onProgress);
  const filename = `dhi-backup-${formatDateForFilename()}.zip`;
  await saveFile(blob, filename);
  await storage.set('lastBackupDate', Date.now());
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT: MARKDOWN ARCHIVE (Human-readable, portable)
// ═══════════════════════════════════════════════════════════════════════════

export async function exportMarkdownArchive(
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  try {
    onProgress?.({ stage: 'gathering', percent: 0, message: 'Loading notes...' });

    const notes = await db.getAllFromStore<Note>('notes');
    const folders = await db.get<Folder[]>('folders') || [];
    const allAssets = await db.getAllFromStore<Asset>('assets');
    const assets = allAssets.filter(a => isValidImageMime(a.mimeType));

    onProgress?.({ stage: 'gathering', percent: 25, message: `Processing ${notes.length} notes...` });

    const zip = new JSZip();
    const assetsFolder = zip.folder('assets')!;

    // FIX #1: Track used file paths to prevent duplicate title overwrite.
    const usedFilePaths = new Set<string>();

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const percent = 25 + Math.floor((i / notes.length) * 50);
      onProgress?.({ stage: 'gathering', percent, message: `Processing "${note.title}"...` });

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

      const sanitizedTitle = sanitizeFilename(note.title);
      const basePath = folderPath
        ? `${folderPath}/${sanitizedTitle}`
        : sanitizedTitle;

      let filePath = `${basePath}.md`;
      let counter = 1;
      while (usedFilePaths.has(filePath)) {
        filePath = `${basePath}-${counter}.md`;
        counter++;
      }
      usedFilePaths.add(filePath);

      zip.file(filePath, frontmatter.join('\n'));
    }

    onProgress?.({ stage: 'compressing', percent: 75, message: 'Adding assets...' });

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

export async function exportSingleNote(noteId: string): Promise<{ blob: Blob; filename: string }> {
  try {
    const note = await db.getFromStore<Note>('notes', noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    const folders = await db.get<Folder[]>('folders') || [];
    const allAssets = await db.getAllFromStore<Asset>('assets');
    const noteAssets = allAssets.filter(a => a.noteId === noteId && isValidImageMime(a.mimeType));

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

    if (noteAssets.length === 0) {
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      return { blob, filename: `${sanitizedTitle}.md` };
    }

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

export async function downloadSingleNote(noteId: string): Promise<void> {
  const { blob, filename } = await exportSingleNote(noteId);
  await saveFile(blob, filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES: Last Backup Tracking
// ═══════════════════════════════════════════════════════════════════════════

export async function getLastBackupDate(): Promise<number | null> {
  return await storage.get<number>('lastBackupDate');
}

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

export async function shouldRecommendBackup(): Promise<boolean> {
  const lastBackup = await getLastBackupDate();

  if (!lastBackup) {
    return true;
  }

  const daysSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
  return daysSinceBackup > 7;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: Parse & Execute
// ═══════════════════════════════════════════════════════════════════════════

export async function parseImportFile(file: File): Promise<ImportPlan> {
  try {
    if (file.name.endsWith('.zip')) {
      return await parseZipImport(file);
    }

    if (file.name.endsWith('.json')) {
      return await parseJSONImport(file);
    }

    if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      return await parseMarkdownImport(file);
    }

    throw new Error('Unsupported file format. Please upload .zip, .json, or .md files.');

  } catch (error) {
    console.error('Import parsing failed:', error);
    throw new Error(`Failed to parse import file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseZipImport(file: File): Promise<ImportPlan> {
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file('dhi-backup.json');
  if (!manifestFile) {
    return await parseMarkdownArchiveFromZip(zip);
  }

  const manifestText = await manifestFile.async('text');
  const manifest: ExportManifest = JSON.parse(manifestText);

  if (!manifest.version || !Array.isArray(manifest.notes)) {
    throw new Error('Invalid DHI backup format');
  }

  const assets: { id: string; blob: Blob; metadata: AssetMetadata }[] = [];
  const assetsFolder = zip.folder('assets');

  if (assetsFolder) {
    for (const [fullPath, zipEntry] of Object.entries(assetsFolder.files)) {
      if (zipEntry.dir) continue;

      const bareFilename = fullPath.split('/').pop()!;
      const dotIndex = bareFilename.lastIndexOf('.');
      const ext = dotIndex !== -1 ? bareFilename.slice(dotIndex + 1) : '';
      const assetId = dotIndex !== -1 ? bareFilename.slice(0, dotIndex) : bareFilename;

      if (!isImageExtension(ext)) {
        console.warn(`Skipping non-image file in assets/: ${bareFilename}`);
        continue;
      }

      const blob = await zipEntry.async('blob');
      const metadata = manifest.assets.find(a => a.id === assetId);

      if (metadata) {
        if (!isValidImageMime(metadata.mimeType)) {
          console.warn(`Skipping asset with invalid MIME type: ${assetId} (${metadata.mimeType})`);
          continue;
        }
        assets.push({ id: assetId, blob, metadata });
      }
    }
  }

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

  const totalSize = assets.reduce((sum, a) => sum + a.blob.size, 0);

  return {
    notes: manifest.notes,
    folders: manifest.folders,
    assets,
    conflicts,
    warnings,
    source: 'dhi-json',
    totalSize,
    containsSettings: !!manifest.settings && Object.keys(manifest.settings).length > 0,
    settings: manifest.settings,
  };
}

async function parseJSONImport(file: File): Promise<ImportPlan> {
  const text = await file.text();
  const manifest: ExportManifest = JSON.parse(text);

  if (!manifest.version || !Array.isArray(manifest.notes)) {
    throw new Error('Invalid DHI backup format');
  }

  const warnings: ImportWarning[] = manifest.assets.map(a => ({
    type: 'missing_asset' as const,
    message: `Image "${a.name}" not included (standalone JSON has no assets)`,
    affectedNoteId: a.noteId,
  }));

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
    containsSettings: !!manifest.settings && Object.keys(manifest.settings).length > 0,
    settings: manifest.settings,
  };
}

// FIX #2: Correctly distinguish DHI Markdown archives from external Markdown
// zips. Checking only the `note-` prefix is sufficient to identify a DHI-native note.
async function parseMarkdownArchiveFromZip(zip: JSZip): Promise<ImportPlan> {
  const notes: Note[] = [];
  const folders: Folder[] = [];
  const assets: { id: string; blob: Blob; metadata: AssetMetadata }[] = [];
  const warnings: ImportWarning[] = [];

  // Extract assets first — with strict validation
  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    for (const [fullPath, zipEntry] of Object.entries(assetsFolder.files)) {
      if (zipEntry.dir) continue;

      const bareFilename = fullPath.split('/').pop()!;
      const dotIndex = bareFilename.lastIndexOf('.');
      const ext = dotIndex !== -1 ? bareFilename.slice(dotIndex + 1) : '';
      const assetId = dotIndex !== -1 ? bareFilename.slice(0, dotIndex) : bareFilename;

      if (!isImageExtension(ext)) {
        console.warn(`Skipping non-image file in assets/: ${bareFilename}`);
        continue;
      }

      const mimeType = getMimeTypeFromExtension(ext);

      if (!isValidImageMime(mimeType)) {
        console.warn(`Skipping file with unrecognised extension: ${bareFilename}`);
        continue;
      }

      const blob = await zipEntry.async('blob');

      assets.push({
        id: assetId,
        blob,
        metadata: {
          id: assetId,
          noteId: '',
          type: 'image',
          name: bareFilename,
          filename: bareFilename,
          size: blob.size,
          mimeType,
          createdAt: Date.now(),
        },
      });
    }
  }

  const folderPathMap = new Map<string, string>();

  let dhiNoteCount = 0;
  let totalNoteCount = 0;

  for (const [filepath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir || !filepath.endsWith('.md') || filepath.startsWith('assets/')) {
      continue;
    }

    const content = await zipEntry.async('text');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      warnings.push({
        type: 'malformed_frontmatter',
        message: `No frontmatter found in "${filepath}"`,
      });
      continue;
    }

    let frontmatter: any = {};
    try {
      frontmatter = yaml.load(frontmatterMatch[1]) as any;
    } catch {
      warnings.push({
        type: 'malformed_frontmatter',
        message: `Could not parse frontmatter in "${filepath}"`,
      });
      continue;
    }

    const noteContent = frontmatterMatch[2];
    totalNoteCount++;

    // FIX #2: A note is DHI-native if its id starts with "note-"
    const isDHINative =
      typeof frontmatter.id === 'string' &&
      frontmatter.id.startsWith('note-');

    if (isDHINative) dhiNoteCount++;

    const pathParts = filepath.split('/');
    pathParts.pop();
    const folderPath = pathParts.join('/');

    let folderId: string | undefined;
    if (folderPath) {
      if (!folderPathMap.has(folderPath)) {
        const newFolderId = frontmatter.folderId || generateId();
        folders.push({
          id: newFolderId,
          name: pathParts[pathParts.length - 1],
          parentId: undefined,
          createdAt: Date.now(),
        });
        folderPathMap.set(folderPath, newFolderId);
      }
      folderId = folderPathMap.get(folderPath);
    }

    const tags: Tag[] = [];
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      for (const tag of frontmatter.tags) {
        if (typeof tag === 'object' && tag.name) {
          tags.push({ name: tag.name, color: tag.color || getNextColorForImport() });
        } else if (typeof tag === 'string') {
          tags.push({ name: tag, color: getNextColorForImport() });
        }
      }
    }

    const note: Note = {
      id: frontmatter.id || generateId(),
      title: frontmatter.title || filepath.split('/').pop()!.replace('.md', ''),
      content: noteContent,
      tags,
      folderId,
      createdAt: frontmatter.created ? new Date(frontmatter.created).getTime() : Date.now(),
      updatedAt: frontmatter.updated ? new Date(frontmatter.updated).getTime() : Date.now(),
      linkedNotes: frontmatter.linkedNotes || extractLinkedNoteIds(noteContent),
    };

    notes.push(note);
  }

  const source: ImportPlan['source'] =
    totalNoteCount > 0 && dhiNoteCount > totalNoteCount / 2
      ? 'dhi-markdown'
      : 'external-markdown';

  // Update asset noteId references
  for (const asset of assets) {
    const note = notes.find(n => n.content.includes(`dhi-asset://${asset.id}`));
    if (note) {
      asset.metadata.noteId = note.id;
    }
  }

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
    source,
    totalSize,
    containsSettings: false,
  };
}

async function parseMarkdownImport(file: File): Promise<ImportPlan> {
  const content = await file.text();
  const warnings: ImportWarning[] = [];

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

  const tags: Tag[] = [];
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      if (typeof tag === 'object' && tag.name) {
        tags.push({ name: tag.name, color: tag.color || getNextColorForImport() });
      } else if (typeof tag === 'string') {
        tags.push({ name: tag, color: getNextColorForImport() });
      }
    }
  }

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

async function detectCollisions(
  existingNotes: Note[],
  existingFolders: Folder[],
  existingAssets: Asset[],
  importedNotes: Note[],
  importedFolders: Folder[],
  importedAssets: AssetMetadata[]
): Promise<ImportConflict[]> {

  const conflicts: ImportConflict[] = [];

  for (const note of importedNotes) {
    const existing = existingNotes.find(n => n.id === note.id);
    if (existing) {
      if (existing.content === note.content && existing.title === note.title) {
        conflicts.push({
          type: 'note',
          oldId: note.id,
          title: note.title,
          action: 'skip',
          reason: 'Note already exists with identical content',
        });
      } else {
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

  for (const folder of importedFolders) {
    const existing = existingFolders.find(f => f.id === folder.id);
    if (existing) {
      if (existing.name === folder.name && existing.parentId === folder.parentId) {
        conflicts.push({
          type: 'folder',
          oldId: folder.id,
          title: folder.name,
          action: 'skip',
          reason: 'Folder already exists with identical name and parent',
        });
      } else {
        conflicts.push({
          type: 'folder',
          oldId: folder.id,
          newId: generateId(),
          title: folder.name,
          action: 'regenerate',
          reason: 'Folder ID collision with different name or parent',
        });
      }
    }
  }

  for (const asset of importedAssets) {
    const existing = existingAssets.find(a => a.id === asset.id);
    if (existing) {
      const owningNoteConflict = conflicts.find(
        c => c.type === 'note' && c.oldId === asset.noteId && c.action === 'skip'
      );
      if (owningNoteConflict) {
        conflicts.push({
          type: 'asset',
          oldId: asset.id,
          title: asset.name,
          action: 'skip',
          reason: 'Asset already exists and owning note is being skipped',
        });
      } else {
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
  }

  return conflicts;
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI LINK & ASSET REFERENCE REMAPPING
// ═══════════════════════════════════════════════════════════════════════════

function remapNoteReferences(
  notes: Note[],
  idMappings: Map<string, string>
): Note[] {
  return notes.map(note => {
    let content = note.content;

    idMappings.forEach((newId, oldId) => {
      const regex = new RegExp(
        `\\[\\[${escapeRegex(oldId)}(\\|[^\\]]+)?\\]\\]`,
        'g'
      );
      content = content.replace(regex, `[[${newId}$1]]`);
    });

    idMappings.forEach((newId, oldId) => {
      if (oldId.startsWith('asset-')) {
        content = content.replace(
          new RegExp(`dhi-asset://${escapeRegex(oldId)}`, 'g'),
          `dhi-asset://${newId}`
        );
      }
    });

    const linkedNotes = extractLinkedNoteIds(content);

    return { ...note, content, linkedNotes };
  });
}

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

    if (folder.parentId) {
      const parent = folders.find(f => f.id === folder.parentId);
      if (parent) visit(parent);
    }

    visiting.delete(folder.id);
    visited.add(folder.id);
    sorted.push(folder);
  }

  folders.forEach(visit);

  return sorted;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

export async function executeImport(
  plan: ImportPlan,
  restoreSettings: boolean = false,
  onProgress?: (progress: ImportProgressCallback) => void
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

  // Total items to process drives the progress bar denominator.
  // Skipped items still count as "processed" so the bar reaches 100%.
  const total = plan.folders.length + plan.assets.length + plan.notes.length;
  let current = 0;

  /**
   * Snapshot the current result counters and emit to the caller.
   * Reading live from `result` (not a local copy) means the UI always sees
   * the true processed count, never a pre-cooked staged estimate.
   */
  const emit = (stage: ImportProgressCallback['stage'], message: string) => {
    onProgress?.({
      stage,
      current,
      total,
      notesImported: result.notesImported,
      foldersCreated: result.foldersCreated,
      assetsImported: result.assetsImported,
      message,
    });
  };

  try {
    // ── Build ID remap table ───────────────────────────────────────────────
    const idMappings = new Map<string, string>();
    for (const conflict of plan.conflicts) {
      if (conflict.action === 'regenerate' && conflict.newId) {
        idMappings.set(conflict.oldId, conflict.newId);
      }
    }

    const noteActionByNewId = new Map<string, ImportConflict['action']>();
    for (const conflict of plan.conflicts) {
      if (conflict.type === 'note') {
        const effectiveId = conflict.action === 'regenerate' && conflict.newId
          ? conflict.newId
          : conflict.oldId;
        noteActionByNewId.set(effectiveId, conflict.action);
      }
    }

    // ── Remap IDs inside note content / linkedNotes ───────────────────────
    let notesToImport = remapNoteReferences(plan.notes, idMappings);

    notesToImport = notesToImport.map(note => {
      const conflict = plan.conflicts.find(c => c.oldId === note.id && c.type === 'note');
      if (conflict?.action === 'regenerate' && conflict.newId) {
        return { ...note, id: conflict.newId };
      }
      return note;
    });

    let foldersToImport = plan.folders.map(folder => {
      const conflict = plan.conflicts.find(c => c.oldId === folder.id && c.type === 'folder');
      if (conflict?.action === 'regenerate' && conflict.newId) {
        const newFolder = { ...folder, id: conflict.newId };
        if (newFolder.parentId && idMappings.has(newFolder.parentId)) {
          newFolder.parentId = idMappings.get(newFolder.parentId);
        }
        return newFolder;
      }
      return folder;
    });

    notesToImport = notesToImport.map(note => {
      if (note.folderId && idMappings.has(note.folderId)) {
        return { ...note, folderId: idMappings.get(note.folderId) };
      }
      return note;
    });

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

    assetsToImport = assetsToImport.map(asset => {
      if (idMappings.has(asset.metadata.noteId)) {
        return {
          ...asset,
          metadata: { ...asset.metadata, noteId: idMappings.get(asset.metadata.noteId)! }
        };
      }
      return asset;
    });

    // ── 1. Folders (topological order) ────────────────────────────────────
    const sortedFolders = topologicalSortFolders(foldersToImport);
    const currentFolders = await db.get<Folder[]>('folders') || [];

    emit(
      'folders',
      plan.folders.length > 0
        ? `Restoring ${plan.folders.length} folder${plan.folders.length !== 1 ? 's' : ''}...`
        : 'Preparing import...'
    );

    for (const folder of sortedFolders) {
      const originalConflict = plan.conflicts.find(c => c.type === 'folder' &&
        (c.oldId === folder.id || c.newId === folder.id)
      );
      const shouldSkip =
        originalConflict?.action === 'skip' ||
        currentFolders.some(f => f.id === folder.id);

      if (!shouldSkip) {
        currentFolders.push(folder);
        result.foldersCreated++;
      }

      current++;
      emit(
        'folders',
        shouldSkip
          ? `Skipping existing folder "${folder.name}"...`
          : `Restored folder "${folder.name}"`
      );
    }
    await db.set('folders', currentFolders);

    // ── 2. Assets ─────────────────────────────────────────────────────────
    if (assetsToImport.length > 0) {
      emit('assets', `Importing ${assetsToImport.length} image${assetsToImport.length !== 1 ? 's' : ''}...`);
    }

    for (const asset of assetsToImport) {
      const conflict = plan.conflicts.find(c => c.oldId === asset.id && c.type === 'asset');

      if (conflict?.action === 'skip') {
        current++;
        emit('assets', `Skipping existing image "${asset.metadata.name}"...`);
        continue;
      }

      if (!isValidImageMime(asset.metadata.mimeType)) {
        console.warn(`Skipping non-image asset during import: ${asset.id}`);
        current++;
        continue;
      }

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
      current++;
      emit('assets', `Imported image ${result.assetsImported} of ${assetsToImport.length}...`);
    }

    // ── 3. Notes ──────────────────────────────────────────────────────────
    if (notesToImport.length > 0) {
      emit('notes', `Importing ${notesToImport.length} note${notesToImport.length !== 1 ? 's' : ''}...`);
    }

    for (const note of notesToImport) {
      const action = noteActionByNewId.get(note.id);

      if (action === 'skip') {
        result.notesSkipped++;
        current++;
        emit('notes', `Skipping "${note.title}"...`);
      } else if (action === 'regenerate') {
        await db.setInStore('notes', note);
        result.notesRegenerated++;
        current++;
        emit('notes', `Imported "${note.title}" (new ID)...`);
      } else {
        await db.setInStore('notes', note);
        result.notesImported++;
        current++;
        emit('notes', `Imported "${note.title}"...`);
      }
    }

    // ── 4. Settings ───────────────────────────────────────────────────────
    if (restoreSettings && plan.containsSettings && plan.settings) {
      emit('finalizing', 'Restoring settings...');
      const currentSettings = await storage.get<AppSettings>('settings');
      if (currentSettings) {
        await storage.set('settings', {
          ...currentSettings,
          ...plan.settings,
          hasCompletedOnboarding: currentSettings.hasCompletedOnboarding,
        });
        result.settingsRestored = true;
      }
    }

    emit('finalizing', 'Finishing up...');
    result.success = true;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('Import execution failed:', error);
  }

  return result;
}

// Re-export for consumers who import ImportResult from this module
export type { ImportResult };
