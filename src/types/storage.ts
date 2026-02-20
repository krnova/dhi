export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface Tag {
  name: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: Tag[];
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  linkedNotes: string[];
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
}

export interface Asset {
  id: string;
  noteId: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  blob: Blob;
  size: number;
  mimeType: string;
  createdAt: number;
}

export interface AppSettings {
  theme: 'agni-ash';
  fontSize: 'sm' | 'base' | 'lg';
  enableJyotish: boolean;
  defaultView: 'editor' | 'vision' | 'time';
  editorMode: 'plain' | 'rich';
  location?: {
    latitude: number;
    longitude: number;
    manual: boolean;
  };
  tagColorPalette?: string[];
}

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
  filename: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

export interface ImportPlan {
  notes: Note[];
  folders: Folder[];
  assets: { id: string; blob: Blob; metadata: AssetMetadata }[];
  conflicts: ImportConflict[];
  warnings: ImportWarning[];
  source: 'dhi-json' | 'dhi-markdown' | 'external-markdown';
  totalSize: number;
  containsSettings: boolean;
  settings?: Partial<AppSettings>;
}

export interface ImportConflict {
  type: 'note' | 'asset' | 'folder';
  oldId: string;
  newId?: string;
  title: string;
  action: 'skip' | 'regenerate';
  reason: string;
}

export interface ImportWarning {
  type: 'missing_asset' 
     | 'unresolved_wiki_link' 
     | 'invalid_tag'
     | 'broken_folder_ref'
     | 'malformed_frontmatter';
  message: string;
  affectedNoteId?: string;
  affectedNoteTitle?: string;
}

export interface ImportResult {
  success: boolean;
  notesImported: number;
  notesSkipped: number;
  notesRegenerated: number;
  foldersCreated: number;
  assetsImported: number;
  conflicts: ImportConflict[];
  warnings: ImportWarning[];
  errors: string[];
  settingsRestored: boolean;
}
