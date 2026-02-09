import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, ChevronRight, Trash2, Eye, Edit3, Columns, MoreVertical, X, Hash, FolderOpen, Folder } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotesStore, getNextTagColor } from '../stores/notesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { AssetImage } from '../components/editor/AssetImage';
import { ConfirmDialog } from '../components/layout/ConfirmDialog';
import { InputDialog } from '../components/layout/InputDialog';
import { TiptapEditor } from '../components/editor/TiptapEditor';
import { FolderTree } from '../components/editor/FolderTree';
import { Backlinks } from '../components/editor/Backlinks';
import { cn } from '../utils/cn';
import { PlainTextImageUpload } from '../components/editor/PlainTextImageUpload';
import { assetService } from '../services/AssetService';
import { extractAssetId } from '../utils/assetUrlHandler';
import type { Folder as FolderType } from '../types/storage';

type ViewMode = 'edit' | 'preview' | 'split';

// ─── Per-note three-dot menu ────────────────────────────────────────────────
// Two internal states: "menu" shows Move/Delete, "move" shows folder picker.
// Back arrow in move picker returns to menu without closing.
function NoteActionMenu({
  noteId,
  noteFolderId,
  folders,
  onMove,
  onDelete,
}: {
  noteId: string;
  noteFolderId?: string;
  folders: FolderType[];
  onMove: (noteId: string, folderId: string | undefined) => void;
  onDelete: () => void;
}) {
  const [state, setState] = useState<'closed' | 'menu' | 'move'>('closed');
  const anchorRef = useRef<HTMLDivElement>(null);

  const getDropdownStyle = (): React.CSSProperties => {
    if (!anchorRef.current) return {};
    const rect = anchorRef.current.getBoundingClientRect();
  
  // Menu dimensions
    const menuWidth = 180;
    const menuHeight = 200; // approximate max height
  
  // Calculate horizontal position
    let left = rect.right + 4;
    if (left + menuWidth > window.innerWidth) {
    // Doesn't fit on right, try left
      left = rect.left - menuWidth - 4;
    }
    if (left < 0) {
    // Doesn't fit on left either, align to right edge with padding
      left = window.innerWidth - menuWidth - 8;
    }
  
  // Calculate vertical position
    let top = rect.top;
    if (top + menuHeight > window.innerHeight) {
    // Doesn't fit below, position above
      top = rect.bottom - menuHeight;
    }
    if (top < 0) {
    // Doesn't fit above either, pin to top with padding
      top = 8;
    }
  
    return { 
      position: 'fixed',
      top: `${top}px`, 
      left: `${left}px`,
      zIndex: 50,
    };
  };
  const renderFolderOption = (folder: FolderType, level: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => { onMove(noteId, folder.id); setState('closed'); }}
          disabled={noteFolderId === folder.id}
          className={cn(
            'w-full text-left py-2 text-sm transition-all flex items-center gap-2',
            noteFolderId === folder.id
              ? 'text-stone-600 cursor-not-allowed'
              : 'text-stone-300 hover:bg-stone-800'
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
          {noteFolderId === folder.id && <span className="text-xs text-stone-600">here</span>}
        </button>
        {children.map(c => renderFolderOption(c, level + 1))}
      </div>
    );
  };

  return (
    <>
      <div
        ref={anchorRef}
        onClick={(e) => { e.stopPropagation(); setState('menu'); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-stone-700 rounded transition-all flex-shrink-0 cursor-pointer flex items-center justify-center"
      >
        <MoreVertical className="w-3.5 h-3.5 text-stone-400" />
      </div>

      {state !== 'closed' && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setState('closed')} />

          <div
            className="fixed z-50 bg-stone-900 border border-stone-700 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[320px] overflow-y-auto"
            style={getDropdownStyle()}
          >
            {/* ── Menu layer ── */}
            {state === 'menu' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setState('move'); }}
                  className="w-full text-left px-3 py-2 text-sm text-stone-300 hover:bg-stone-800 transition-all flex items-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Move to folder
                </button>
                <div className="border-t border-stone-800 my-0.5" />
                <button
                  onClick={(e) => { e.stopPropagation(); setState('closed'); onDelete(); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </>
            )}

            {/* ── Move picker layer ── */}
            {state === 'move' && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-800">
                  <button onClick={() => setState('menu')} className="p-0.5 hover:bg-stone-800 rounded">
                    <ChevronRight className="w-3 h-3 text-stone-400 rotate-180" />
                  </button>
                  <span className="text-xs font-medium text-stone-400">Move to</span>
                </div>

                {/* No folder option */}
                <button
                  onClick={() => { onMove(noteId, undefined); setState('closed'); }}
                  disabled={noteFolderId === undefined}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-all flex items-center gap-2',
                    noteFolderId === undefined
                      ? 'text-stone-600 cursor-not-allowed'
                      : 'text-stone-300 hover:bg-stone-800'
                  )}
                >
                  <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="flex-1">No Folder</span>
                  {noteFolderId === undefined && <span className="text-xs text-stone-600">here</span>}
                </button>

                {/* Folder tree */}
                {folders.filter(f => !f.parentId).map(f => renderFolderOption(f))}

                {folders.length === 0 && (
                  <div className="px-3 py-5 text-center text-xs text-stone-500">No folders yet</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export const SmritiPage: React.FC = () => {
  const {
    notes,
    folders,
    currentNoteId,
    isLoading,
    loadNotes,
    loadFolders,
    createNote,
    setCurrentNote,
    getCurrentNote,
    getNoteById,
    updateNoteOptimistic,
    deleteNote,
    addTag,
    removeTag,
    searchNotes,
    createFolder,
    deleteFolder,
    renameFolder,
    moveNote,
    getBacklinks,
  } = useNotesStore();

  const { settings } = useSettingsStore();

  // ── UI state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [showFolders, setShowFolders] = useState(true);

  // ── Dialog state ──
  const [deleteNoteConfirm, setDeleteNoteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [createFolderDialog, setCreateFolderDialog] = useState<{ isOpen: boolean; parentId?: string }>({ isOpen: false });
  const [renameFolderDialog, setRenameFolderDialog] = useState<{ isOpen: boolean; folderId: string; currentName: string } | null>(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{ id: string; name: string; hasChildren: boolean } | null>(null);

  // ── Load data ──
  useEffect(() => {
    loadNotes();
    loadFolders();
  }, [loadNotes, loadFolders]);

  // ── Collapse sidebar on mobile when a note is selected ──
  useEffect(() => {
    if (currentNoteId && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [currentNoteId]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setViewMode(prev => prev === 'edit' ? 'preview' : 'edit');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Orphaned asset cleanup on note change ──
  const currentNote = getCurrentNote();

  useEffect(() => {
    if (!currentNote) return;
    const cleanupTimeout = setTimeout(async () => {
      const deleted = await assetService.deleteOrphanedAssets(currentNote.content, currentNote.id);
      if (deleted > 0) console.log(`Cleaned up ${deleted} orphaned image(s)`);
    }, 5000);
    return () => clearTimeout(cleanupTimeout);
  }, [currentNote?.content, currentNote?.id]);

  // ── Get backlinks for current note ──
  const backlinks = currentNote ? getBacklinks(currentNote.id) : [];

  // ── Note handlers ──
  const handleCreateNote = async () => {
    try {
      const note = await createNote('Untitled Note', selectedFolderId);
      setCurrentNote(note.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const confirmDeleteNote = async () => {
    if (!deleteNoteConfirm) return;
    try {
      await assetService.deleteNoteAssets(deleteNoteConfirm.id);
      await deleteNote(deleteNoteConfirm.id);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // ── Folder handlers ──
  const handleCreateFolder = async (name: string) => {
    if (name.trim()) {
      await createFolder(name, createFolderDialog.parentId);
      setCreateFolderDialog({ isOpen: false });
    }
  };

  const handleRenameFolder = async (newName: string) => {
    if (renameFolderDialog && newName.trim()) {
      await renameFolder(renameFolderDialog.folderId, newName);
      setRenameFolderDialog(null);
    }
  };

  const handleRequestDeleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const children = folders.filter(f => f.parentId === folderId);
    setDeleteFolderConfirm({ id: folderId, name: folder.name, hasChildren: children.length > 0 });
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderConfirm) return;
    await deleteFolder(deleteFolderConfirm.id);
    if (selectedFolderId === deleteFolderConfirm.id) setSelectedFolderId(undefined);
    setDeleteFolderConfirm(null);
  };

  // ── Tag handler ──
  const handleRemoveTag = async (tagName: string) => {
    if (currentNote) await removeTag(currentNote.id, tagName);
  };

  // ── Filtered note list ──
  let filteredNotes = searchQuery ? searchNotes(searchQuery) : notes;
  if (selectedFolderId !== undefined) {
    filteredNotes = filteredNotes.filter(n => n.folderId === selectedFolderId);
  }

  // ── Wiki link click handler (preview mode) ──
  const handleWikiLinkClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const text = target.textContent;
    if (text && text.startsWith('[[') && text.endsWith(']]')) {
      e.preventDefault();
      const match = text.match(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/);
      if (match) {
        const note = getNoteById(match[1]);
        if (note) setCurrentNote(note.id);
      }
    }
  };

  // ── Wiki link inline renderer (preview mode) ──
  const renderWikiLinkText = (text: string): React.ReactNode => {
    const wikiLinkRegex = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = wikiLinkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));

      const noteId = match[1];
      const displayText = match[2] || getNoteById(noteId)?.title || noteId;

      parts.push(
        <span
          key={match.index}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const note = getNoteById(noteId);
            if (note) setCurrentNote(note.id);
          }}
          style={{
            color: '#60a5fa',
            textDecoration: 'none',
            borderBottom: '1px solid #60a5fa',
            cursor: 'pointer',
            padding: '0 2px',
            borderRadius: '2px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {displayText}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts.length > 0 ? parts : text;
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Loading notes...</div>
      </div>
    );
  }

  const isRichEditor = settings.editorMode === 'rich';

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex h-full relative">

        {/* ════════════════════════════════════════════════════════ SIDEBAR ═══ */}
        <div
          className={cn(
            'bg-stone-900 border-r border-stone-800 transition-all flex-shrink-0 absolute md:relative z-10 h-full',
            sidebarOpen ? 'w-full md:w-72' : 'w-0 overflow-hidden'
          )}
        >
          <div className="h-full flex flex-col">

            {/* Header: title + new note button */}
            <div className="p-3 md:p-4 border-b border-stone-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-sand">स्मृति</h2>
                  <p className="text-xs text-stone-500">{filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}</p>
                </div>
                <button
                  onClick={handleCreateNote}
                  className="bg-bhagwa text-white rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 flex-shrink-0 px-2.5 h-10"
                  title="New Note (Ctrl+N)"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">New</span>
                </button>
              </div>

              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Search notes or #tag"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-base w-full pl-8 text-xs"
                  />
                </div>
                {searchQuery.startsWith('#') && (
                  <p className="text-xs text-bhagwa mt-1 ml-1">
                    <Hash className="w-3 h-3 inline mr-0.5" />
                    Filtering by tag
                  </p>
                )}
              </div>
            </div>

            {/* Folder section toggle */}
            <div className="px-3 pt-2 pb-2 border-b border-stone-800">
              <button
                onClick={() => setShowFolders(!showFolders)}
                className="flex items-center gap-2 text-xs text-stone-400 hover:text-sand transition-all w-full"
              >
                <ChevronRight className={cn('w-3 h-3 transition-transform', showFolders && 'rotate-90')} />
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folders</span>
              </button>
            </div>

            {/* Folder tree */}
            {showFolders && (
              <div className="px-2 border-b border-stone-800">
                <FolderTree
                  folders={folders}
                  notes={notes}
                  selectedFolderId={selectedFolderId}
                  currentNoteId={currentNoteId || undefined}
                  onFolderSelect={setSelectedFolderId}
                  onNoteSelect={setCurrentNote}
                  onRequestCreateChild={(parentId) => setCreateFolderDialog({ isOpen: true, parentId })}
                  onRequestDelete={handleRequestDeleteFolder}
                  onRequestRename={(folderId, currentName) => setRenameFolderDialog({ isOpen: true, folderId, currentName })}
                  onMoveNote={async (noteId, targetFolderId) => { await moveNote(noteId, targetFolderId); }}
                />
              </div>
            )}

            {/* Note list */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="text-stone-500 text-sm mb-1">
                      {notes.length === 0 ? 'No notes yet' : 'No matching notes'}
                    </div>
                    {notes.length === 0 && (
                      <button onClick={handleCreateNote} className="text-xs text-bhagwa hover:underline mt-2">
                        Create your first note
                      </button>
                    )}
                  </div>
                ) : (
                  filteredNotes.map((note) => {
                    const folderLabel = note.folderId ? folders.find(f => f.id === note.folderId) : null;
                    return (
                      <div key={note.id} className="relative group">
                        {/* Note card */}
                        <button
                          onClick={() => setCurrentNote(note.id)}
                          className={cn(
                            'w-full text-left p-2.5 rounded-lg transition-all min-h-[44px] pr-8',
                            currentNoteId === note.id
                              ? 'bg-bhagwa/10 border border-bhagwa/20'
                              : 'hover:bg-stone-800 border border-transparent'
                          )}
                        >
                          <div className="text-sm font-medium text-sand truncate leading-tight">{note.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-stone-500">
                              {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            {folderLabel && (
                              <span className="text-xs text-stone-600 flex items-center gap-0.5">
                                <FolderOpen className="w-2.5 h-2.5" />
                                {folderLabel.name}
                              </span>
                            )}
                          </div>
                          {note.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {note.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag.name}
                                  className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    border: `1px solid ${tag.color}40`,
                                  }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {note.tags.length > 3 && (
                                <span className="text-xs text-stone-600">+{note.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </button>

                        {/* Three-dot action menu — anchored top-right of card */}
                        <div className="absolute top-2 right-1 z-10">
                          <NoteActionMenu
                            noteId={note.id}
                            noteFolderId={note.folderId}
                            folders={folders}
                            onMove={(nId, fId) => moveNote(nId, fId)}
                            onDelete={() => setDeleteNoteConfirm({ id: note.id, title: note.title })}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════ MAIN CONTENT ═══ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar: sidebar toggle, title input, view mode switcher */}
          <div className="bg-stone-900 border-b border-stone-800 p-3 flex items-center gap-2 safe-area-inset">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-icon" title="Toggle Sidebar">
              <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
            </button>

            {currentNote && (
              <>
                <input
                  type="text"
                  value={currentNote.title}
                  onChange={(e) => updateNoteOptimistic(currentNote.id, { title: e.target.value })}
                  className="input-base flex-1 font-semibold text-sm min-w-0"
                  placeholder="Note title..."
                />

                {/* Desktop view mode buttons */}
                <div className="hidden md:flex gap-0.5 bg-stone-800 rounded-lg p-0.5">
                  {([
                    { mode: 'edit' as ViewMode, Icon: Edit3 },
                    { mode: 'split' as ViewMode, Icon: Columns },
                    { mode: 'preview' as ViewMode, Icon: Eye },
                  ]).map(({ mode, Icon }) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'px-2.5 py-1.5 rounded transition-all',
                        viewMode === mode ? 'bg-bhagwa text-white' : 'text-stone-400 hover:text-sand'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>

                {/* Mobile view mode menu */}
                <div className="md:hidden relative">
                  <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="btn-icon">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {showMobileMenu && (
                    <div className="absolute top-full right-0 mt-2 bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-1 z-20 min-w-[140px]">
                      {([
                        { mode: 'edit' as ViewMode, Icon: Edit3, label: 'Edit' },
                        { mode: 'preview' as ViewMode, Icon: Eye, label: 'Preview' },
                      ]).map(({ mode, Icon, label }) => (
                        <button
                          key={mode}
                          onClick={() => { setViewMode(mode); setShowMobileMenu(false); }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-all',
                            viewMode === mode ? 'bg-bhagwa/10 text-bhagwa' : 'text-stone-400 hover:bg-stone-800 hover:text-sand'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {currentNote ? (
              <div className="h-full flex flex-col">

                {/* Backlinks bar */}
                <Backlinks
                  backlinks={backlinks}
                  onNoteClick={setCurrentNote}
                  currentNoteId={currentNote.id}
                />

                {/* Tags bar */}
                <div className="p-3 border-b border-stone-800 bg-stone-900">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-3.5 h-3.5 text-bhagwa" />
                    <span className="text-xs text-stone-400 font-medium">Tags</span>
                  </div>

                  {currentNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {currentNote.tags.map(tag => (
                        <span
                          key={tag.name}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-xs hover:opacity-80 transition-opacity min-h-[32px]"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            border: `1px solid ${tag.color}40`,
                          }}
                        >
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTag(tag.name)}
                            className="opacity-60 hover:opacity-100 transition-opacity min-w-[20px] min-h-[20px] flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!tagInput.trim() || !currentNote) return;
                    const newTags = tagInput.trim().replace(/^#/, '').split(',').map(t => t.trim()).filter(Boolean);
                    for (const tagName of newTags) {
                      await addTag(currentNote.id, { name: tagName, color: getNextTagColor() });
                    }
                    setTagInput('');
                  }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Work, Personal, Office, etc."
                      className="input-base w-full text-xs"
                    />
                  </form>
                </div>

                {/* Editor + Preview panes */}
                <div className="flex-1 flex overflow-hidden">

                  {/* Editor pane */}
                  {(viewMode === 'edit' || viewMode === 'split') && (
                    <div className={cn('overflow-hidden', viewMode === 'split' ? 'flex-1 border-r border-stone-800' : 'flex-1')}>
                      {isRichEditor ? (
                        <TiptapEditor
                          content={currentNote.content}
                          onChange={(content) => updateNoteOptimistic(currentNote.id, { content })}
                          placeholder="Start writing... (Markdown supported)"
                          noteId={currentNote.id}
                        />
                      ) : (
                        <div className="flex flex-col h-full">
                          <div className="border-b border-stone-800 bg-stone-900 p-2 flex items-center gap-2">
                            <PlainTextImageUpload
                              noteId={currentNote.id}
                              onInsert={(markdown) => {
                                updateNoteOptimistic(currentNote.id, { content: currentNote.content + '\n' + markdown + '\n' });
                              }}
                            />
                            <span className="text-xs text-stone-500">Plain Text Mode - Insert markdown syntax</span>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            <textarea
                              value={currentNote.content}
                              onChange={(e) => updateNoteOptimistic(currentNote.id, { content: e.target.value })}
                              className="w-full h-full bg-transparent text-sand resize-none focus:outline-none leading-relaxed font-mono text-sm"
                              placeholder="Start writing... (Markdown supported)"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preview pane */}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                      <div
                        className="prose prose-invert prose-stone max-w-none prose-sm md:prose-base"
                        onClick={handleWikiLinkClick}
                      >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            urlTransform={(value) => value}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-sand mb-3 mt-4" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-sand mb-2 mt-4" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-sand mb-2 mt-3" {...props} />,
              p: ({ node, children, ...props }) => (
                <p className="text-stone-300 mb-3 leading-relaxed text-sm" {...props}>
                  {React.Children.map(children, (child) => 
                    typeof child === 'string' ? renderWikiLinkText(child) : child
                  )}
                </p>
              ),
                              ul: ({ node, ...props }) => <ul className="list-disc list-inside text-stone-300 mb-3 space-y-1 text-sm" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal list-inside text-stone-300 mb-3 space-y-1 text-sm" {...props} />,
                              code: ({ node, inline, ...props }: any) =>
                                inline
                                  ? <code className="bg-stone-800 text-bhagwa px-1 py-0.5 rounded text-xs" {...props} />
                                  : <code className="block bg-stone-800 text-sand p-3 rounded-lg overflow-x-auto mb-3 text-xs" {...props} />,
                              blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-bhagwa pl-3 italic text-stone-400 mb-3 text-sm" {...props} />,
                              a: ({ node, href, children, ...props }) => (
                                <a
                                  href={href}
                                  className="text-bhagwa hover:text-orange-400 underline underline-offset-2 cursor-pointer transition-colors duration-200"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  {...props}
                                >
                                  {children}
                                </a>
                              ),
                              img: ({ node, src, alt, ...props }) => {
                                if (!src) return null;
                                const assetId = extractAssetId(src);
                                if (assetId) return <AssetImage assetId={assetId} alt={alt} />;
                                return <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-2" {...props} />;
                              },
                            }}
                          >
                            {currentNote.content || '*No content yet*'}
                          </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state — no note selected */
              <div className="flex items-center justify-center h-full text-stone-500 p-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-stone-800 flex items-center justify-center">
                    <Edit3 className="w-6 h-6 text-stone-600" />
                  </div>
                  <p className="text-sm mb-1">No note selected</p>
                  <button onClick={() => setSidebarOpen(true)} className="text-xs text-bhagwa hover:underline md:hidden">
                    Open notes list
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ DIALOGS ═══ */}
      <InputDialog
        isOpen={createFolderDialog.isOpen}
        title={createFolderDialog.parentId ? 'New Subfolder' : 'New Folder'}
        placeholder="Enter folder name"
        confirmText="Create"
        onConfirm={handleCreateFolder}
        onCancel={() => setCreateFolderDialog({ isOpen: false })}
      />

      <InputDialog
        isOpen={renameFolderDialog?.isOpen || false}
        title="Rename Folder"
        placeholder="Enter new name"
        defaultValue={renameFolderDialog?.currentName || ''}
        confirmText="Rename"
        onConfirm={handleRenameFolder}
        onCancel={() => setRenameFolderDialog(null)}
      />

      <ConfirmDialog
        isOpen={deleteFolderConfirm !== null}
        title="Delete Folder"
        message={
          deleteFolderConfirm?.hasChildren
            ? `Delete "${deleteFolderConfirm.name}" and all its subfolders? Notes inside will be moved out.`
            : `Delete folder "${deleteFolderConfirm?.name}"? Notes inside will be moved out.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeleteFolderConfirm(null)}
      />

      <ConfirmDialog
        isOpen={deleteNoteConfirm !== null}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteNoteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDeleteNote}
        onCancel={() => setDeleteNoteConfirm(null)}
      />
    </>
  );
}
