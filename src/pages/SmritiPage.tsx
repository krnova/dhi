import React, { useEffect, useState } from 'react';
import { Plus, Search, ChevronRight, Trash2, Eye, Edit3, Columns, MoreVertical, X, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotesStore, getNextTagColor } from '../stores/notesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ConfirmDialog } from '../components/layout/ConfirmDialog';
import { TiptapEditor } from '../components/editor/TiptapEditor';
import { cn } from '../utils/cn';
import type { Tag } from '../types/storage';

type ViewMode = 'edit' | 'preview' | 'split';

export const SmritiPage: React.FC = () => {
  const {
    notes,
    currentNoteId,
    isLoading,
    loadNotes,
    createNote,
    setCurrentNote,
    getCurrentNote,
    updateNote,
    deleteNote,
    addTag,
    removeTag,
    searchNotes,
  } = useNotesStore();

  const { settings } = useSettingsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (currentNoteId && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [currentNoteId]);

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

  const handleCreateNote = async () => {
    try {
      const note = await createNote('Untitled Note');
      setCurrentNote(note.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string, noteTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ id: noteId, title: noteTitle });
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      try {
        await deleteNote(deleteConfirm.id);
      } catch (error) {
        console.error('Failed to delete note:', error);
      }
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (currentNote) {
      await removeTag(currentNote.id, tagName);
    }
  };

  const filteredNotes = searchQuery ? searchNotes(searchQuery) : notes;
  const currentNote = getCurrentNote();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-stone-400 text-sm">Loading notes...</div>
      </div>
    );
  }

  const isRichEditor = settings.editorMode === 'rich';

  return (
    <>
      <div className="flex h-full relative">
        {/* Notes Sidebar */}
        <div
          className={cn(
            'bg-stone-900 border-r border-stone-800 transition-all flex-shrink-0 absolute md:relative z-10 h-full',
            sidebarOpen ? 'w-full md:w-72' : 'w-0 overflow-hidden'
          )}
        >
          <div className="h-full flex flex-col">
            <div className="p-3 md:p-4 border-b border-stone-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-sand">स्मृति</h2>
                  <p className="text-xs text-stone-500">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>
                </div>
                <button
                  onClick={handleCreateNote}
                  className="bg-bhagwa text-white rounded-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 flex-shrink-0 w-auto px-2.5 h-10"
                  title="New Note (Ctrl+N)"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">New</span>
                </button>
              </div>

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
                  filteredNotes.map((note) => (
                    <div key={note.id} className="relative group">
                      <button
                        onClick={() => setCurrentNote(note.id)}
                        className={cn(
                          'w-full text-left p-2.5 rounded-lg transition-all min-h-[44px]',
                          currentNoteId === note.id
                            ? 'bg-bhagwa/10 border border-bhagwa/20'
                            : 'hover:bg-stone-800 border border-transparent'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-sand truncate leading-tight">{note.title}</div>
                            <div className="text-xs text-stone-500 mt-1">
                              {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            {note.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {note.tags.slice(0, 3).map(tag => (
                                  <span
                                    key={tag.name}
                                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                                    style={{
                                      backgroundColor: `${tag.color}20`,
                                      color: tag.color,
                                      border: `1px solid ${tag.color}40`
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
                          </div>
                          <div
                            onClick={(e) => handleDeleteNote(note.id, note.title, e)}
                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded transition-all flex-shrink-0 cursor-pointer flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </div>
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-stone-900 border-b border-stone-800 p-3 flex items-center gap-2 safe-area-inset">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn-icon"
              title="Toggle Sidebar"
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', sidebarOpen && 'rotate-180')} />
            </button>

            {currentNote && (
              <>
                <input
                  type="text"
                  value={currentNote.title}
                  onChange={(e) => updateNote(currentNote.id, { title: e.target.value })}
                  className="input-base flex-1 font-semibold text-sm min-w-0"
                  placeholder="Note title..."
                />

                <div className="hidden md:flex gap-0.5 bg-stone-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('edit')}
                    className={cn(
                      'px-2.5 py-1.5 rounded transition-all',
                      viewMode === 'edit' ? 'bg-bhagwa text-white' : 'text-stone-400 hover:text-sand'
                    )}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'px-2.5 py-1.5 rounded transition-all',
                      viewMode === 'split' ? 'bg-bhagwa text-white' : 'text-stone-400 hover:text-sand'
                    )}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'px-2.5 py-1.5 rounded transition-all',
                      viewMode === 'preview' ? 'bg-bhagwa text-white' : 'text-stone-400 hover:text-sand'
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="md:hidden relative">
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="btn-icon"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showMobileMenu && (
                    <div className="absolute top-full right-0 mt-2 bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-1 z-20 min-w-[140px]">
                      <button
                        onClick={() => {
                          setViewMode('edit');
                          setShowMobileMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-all',
                          viewMode === 'edit' ? 'bg-bhagwa/10 text-bhagwa' : 'text-stone-400 hover:bg-stone-800 hover:text-sand'
                        )}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setViewMode('preview');
                          setShowMobileMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-all',
                          viewMode === 'preview' ? 'bg-bhagwa/10 text-bhagwa' : 'text-stone-400 hover:bg-stone-800 hover:text-sand'
                        )}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {currentNote ? (
              <div className="h-full flex flex-col">
                {/* Tags Section */}
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-xs group cursor-pointer hover:opacity-80 transition-opacity min-h-[32px]"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                            border: `1px solid ${tag.color}40`
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
                    if (tagInput.trim() && currentNote) {
                      const input = tagInput.trim().replace(/^#/, '');
                      const newTags = input.split(',').map(t => t.trim()).filter(t => t.length > 0);

                      for (const tagName of newTags) {
                        const tag: Tag = { name: tagName, color: getNextTagColor() };
                        await addTag(currentNote.id, tag);
                      }

                      setTagInput('');
                    }
                  }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Work, Personal, Office, etc."
                      className="input-base w-full text-xs"
                    />
                  </form>
                  <p className="text-xs text-stone-600 mt-1.5">
                    Separate tags with commas. Press Enter to add.
                  </p>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {(viewMode === 'edit' || viewMode === 'split') && (
                    <div className={cn('overflow-hidden', viewMode === 'split' ? 'flex-1 border-r border-stone-800' : 'flex-1')}>
                      {isRichEditor ? (
                        <TiptapEditor
                          content={currentNote.content}
                          onChange={(content) => updateNote(currentNote.id, { content })}
                          placeholder="Start writing... (Markdown supported)"
                        />
                      ) : (
                        <div className="p-4 md:p-6 overflow-y-auto h-full">
                          <textarea
                            value={currentNote.content}
                            onChange={(e) => updateNote(currentNote.id, { content: e.target.value })}
                            className="w-full h-full bg-transparent text-sand resize-none focus:outline-none leading-relaxed font-mono text-sm"
                            placeholder="Start writing... (Markdown supported)"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className={cn('p-4 md:p-6 overflow-y-auto', viewMode === 'split' ? 'flex-1' : 'flex-1')}>
                      <div className="prose prose-invert prose-stone max-w-none prose-sm md:prose-base">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-sand mb-3 mt-4" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-sand mb-2 mt-4" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-sand mb-2 mt-3" {...props} />,
                            p: ({node, ...props}) => <p className="text-stone-300 mb-3 leading-relaxed text-sm" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside text-stone-300 mb-3 space-y-1 text-sm" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside text-stone-300 mb-3 space-y-1 text-sm" {...props} />,
                            code: ({node, inline, className, children, ...props}: any) =>
                              inline
                                ? <code className="bg-stone-800 text-bhagwa px-1 py-0.5 rounded text-xs" {...props} />
                                : <code className="block bg-stone-800 text-sand p-3 rounded-lg overflow-x-auto mb-3 text-xs" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-bhagwa pl-3 italic text-stone-400 mb-3 text-sm" {...props} />,
                            a: ({node, ...props}) => <a className="text-bhagwa hover:underline" {...props} />,
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
              <div className="flex items-center justify-center h-full text-stone-500 p-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-stone-800 flex items-center justify-center">
                    <Edit3 className="w-6 h-6 text-stone-600" />
                  </div>
                  <p className="text-sm mb-1">No note selected</p>
                  <p className="text-xs text-stone-600 mb-4">Create or select a note to start writing</p>
                  <button onClick={() => setSidebarOpen(true)} className="text-xs text-bhagwa hover:underline md:hidden">
                    Open notes list
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
};
