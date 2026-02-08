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
