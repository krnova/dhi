// Notes Store with Debounced Updates
import { create } from 'zustand';
import { perfMonitor } from '../utils/performance';
import type { Note, Folder, Tag } from '../types/storage';
import { IndexedDBAdapter } from '../services/IndexedDBAdapter';
import { extractLinkedNoteIds } from '../utils/wikiLinks';

interface NotesState {
  notes: Note[];
  folders: Folder[];
  currentNoteId: string | null;
  isLoading: boolean;
  
  loadNotes: () => Promise<void>;
  loadFolders: () => Promise<void>;
  
  createNote: (title: string, folderId?: string) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  updateNoteOptimistic: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => Promise<void>;
  
  addTag: (noteId: string, tag: Tag) => Promise<void>;
  removeTag: (noteId: string, tagName: string) => Promise<void>;
  
  createFolder: (name: string, parentId?: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  moveNote: (noteId: string, targetFolderId: string | undefined) => Promise<void>;
  
  setCurrentNote: (id: string | null) => void;
  getCurrentNote: () => Note | null;
  
  searchNotes: (query: string) => Note[];
  getBacklinks: (noteId: string) => Note[];
  getNoteById: (id: string) => Note | null;
  getNoteTitleById: (id: string) => string | null;
}

const db = new IndexedDBAdapter();

// Debounce timer map for note updates
const updateTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Generate human-readable note ID: note-ddmmyy-hhmmss-random
const generateId = () => {
  const now = new Date();
  const date = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 3);
  return `note-${date}-${time}-${random}`;
};

// Default tag colors
export const DEFAULT_TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
];

let colorIndex = 0;

const getNextColor = () => {
  // Try to get custom palette from localStorage
  let palette = DEFAULT_TAG_COLORS;
  try {
    const settings = localStorage.getItem('dhi_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.tagColorPalette && Array.isArray(parsed.tagColorPalette) && parsed.tagColorPalette.length > 0) {
        palette = parsed.tagColorPalette;
      }
    }
  } catch (err) {
    console.error('Failed to load custom tag palette:', err);
  }
  
  const color = palette[colorIndex];
  colorIndex = (colorIndex + 1) % palette.length;
  return color;
};

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  folders: [],
  currentNoteId: null,
  isLoading: true,

  loadNotes: async () => {
    try {
      const notes = await db.getAllFromStore<Note>('notes');
      set({ notes: notes.sort((a, b) => b.updatedAt - a.updatedAt), isLoading: false });
    } catch (error) {
      console.error('Failed to load notes:', error);
      set({ isLoading: false });
    }
  },

  loadFolders: async () => {
    try {
      const folders = await db.get<Folder[]>('folders') || [];
      set({ folders });
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  },

  createNote: async (title, folderId) => {
    const note: Note = {
      id: generateId(),
      title: title || 'Untitled',
      content: '',
      tags: [],
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      linkedNotes: [],
    };

    try {
      await db.setInStore('notes', note);
      set(state => ({ notes: [note, ...state.notes] }));
      return note;
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  },

  clearNoteTimers: (noteId: string) => {
    const timer = updateTimers.get(noteId);
    if (timer) {
      clearTimeout(timer);
      updateTimers.delete(noteId);
    }
  },

  updateNoteOptimistic: (id, updates) => {
    perfMonitor.mark('update-start');
    const state = get();
    const note = state.notes.find(n => n.id === id);
    
    if (!note) return;

    // 🔥 DEBUG: Log extraction
    let linkedNotes = note.linkedNotes;
    if (updates.content !== undefined) {
      linkedNotes = extractLinkedNoteIds(updates.content);
    }

    const updatedNote: Note = {
      ...note,
      ...updates,
      id: note.id,
      linkedNotes,
      updatedAt: Date.now(),
    };

    set(state => ({
      notes: state.notes.map(n => n.id === id ? updatedNote : n)
    }));

    const existingTimer = updateTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        await db.setInStore('notes', updatedNote);
        updateTimers.delete(id);
      } catch (error) {
        console.error('Failed to persist note update:', error);
      }
    }, 500);

    updateTimers.set(id, timer);
    perfMonitor.mark('update-end');
    perfMonitor.measure('note-update', 'update-start', 'update-end');
  },

  updateNote: async (id, updates) => {
    try {
      const state = get();
      const note = state.notes.find(n => n.id === id);
      
      if (!note) {
        throw new Error('Note not found');
      }

      const linkedNotes = updates.content !== undefined
        ? extractLinkedNoteIds(updates.content)
        : note.linkedNotes;

      const updatedNote: Note = {
        ...note,
        ...updates,
        id: note.id,
        linkedNotes,
        updatedAt: Date.now(),
      };

      await db.setInStore('notes', updatedNote);
      
      set(state => ({
        notes: state.notes.map(n => n.id === id ? updatedNote : n)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      }));
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error;
    }
  },

  deleteNote: async (id) => {
    try {
      await db.deleteFromStore('notes', id);
      set(state => ({
        notes: state.notes.filter(n => n.id !== id),
        currentNoteId: state.currentNoteId === id ? null : state.currentNoteId
      }));
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  },

  addTag: async (noteId, tag) => {
    const state = get();
    const note = state.notes.find(n => n.id === noteId);
    
    if (!note) return;

    if (note.tags.some(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
      return;
    }

    await get().updateNote(noteId, {
      tags: [...note.tags, tag]
    });
  },

  removeTag: async (noteId, tagName) => {
    const state = get();
    const note = state.notes.find(n => n.id === noteId);
    
    if (!note) return;

    await get().updateNote(noteId, {
      tags: note.tags.filter(t => t.name !== tagName)
    });
  },

  createFolder: async (name, parentId) => {
    const folder: Folder = {
      id: generateId(),
      name,
      parentId,
      createdAt: Date.now(),
    };

    try {
      const folders = [...get().folders, folder];
      await db.set('folders', folders);
      set({ folders });
      return folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  deleteFolder: async (id) => {
    try {
      const allFolders = get().folders;
      const toDelete = new Set<string>();

      const collectDescendants = (folderId: string) => {
        toDelete.add(folderId);
        allFolders
          .filter(f => f.parentId === folderId)
          .forEach(child => collectDescendants(child.id));
      };

      collectDescendants(id);

      const folders = allFolders.filter(f => !toDelete.has(f.id));
      await db.set('folders', folders);

      const notes = get().notes;
      const orphanedNotes = notes.filter(n => n.folderId && toDelete.has(n.folderId));

      for (const note of orphanedNotes) {
        const updated: Note = { ...note, folderId: undefined, updatedAt: Date.now() };
        await db.setInStore('notes', updated);
      }

      set(state => ({
        folders,
        notes: state.notes.map(n =>
          n.folderId && toDelete.has(n.folderId)
            ? { ...n, folderId: undefined, updatedAt: Date.now() }
            : n
        ),
      }));
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  },

  renameFolder: async (id, newName) => {
    const state = get();
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;

    const folders = state.folders.map(f =>
      f.id === id ? { ...f, name: newName } : f
    );

    try {
      await db.set('folders', folders);
      set({ folders });
    } catch (error) {
      console.error('Failed to rename folder:', error);
      throw error;
    }
  },

  moveNote: async (noteId, targetFolderId) => {
    const state = get();
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;

    const updatedNote: Note = {
      ...note,
      folderId: targetFolderId,
      updatedAt: Date.now(),
    };

    try {
      await db.setInStore('notes', updatedNote);
      set(state => ({
        notes: state.notes.map(n => n.id === noteId ? updatedNote : n)
      }));
    } catch (error) {
      console.error('Failed to move note:', error);
      throw error;
    }
  },

  setCurrentNote: (id) => {
    const prev = get().currentNoteId;
    if (prev) {
      const timer = updateTimers.get(prev);
      if (timer) {
        clearTimeout(timer);
        updateTimers.delete(prev);
      }
    }
    set({ currentNoteId: id });
  },

  getCurrentNote: () => {
    const { notes, currentNoteId } = get();
    return notes.find(n => n.id === currentNoteId) || null;
  },

  searchNotes: (query) => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.startsWith('#')) {
      const tagQuery = lowerQuery.substring(1);
      return get().notes.filter(note =>
        note.tags.some(tag => tag.name.toLowerCase().includes(tagQuery))
      );
    }
    
    return get().notes.filter(note =>
      note.title.toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.name.toLowerCase().includes(lowerQuery))
    );
  },

  getBacklinks: (noteId) => {
    return get().notes.filter(note => note.linkedNotes.includes(noteId));
  },

  getNoteById: (id) => {
    return get().notes.find(n => n.id === id) || null;
  },

  getNoteTitleById: (id) => {
    const note = get().notes.find(n => n.id === id);
    return note ? note.title : null;
  },
}));

export const getNextTagColor = getNextColor;
