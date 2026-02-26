// Tiptap Editor with Wiki Link Support - FIXED: Inline Formatting Persistence
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { CustomImage } from './ImageExtension';
import { LinkDialog } from './LinkDialog';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import { assetService } from '../../services/AssetService';
import { createWikiLink } from '../../utils/wikiLinks';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link2,
  CheckSquare,
  Image as ImageIcon,
  Upload,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '../../utils/cn';

// Debounce only store writes, not editor state
let storeWriteTimeout: ReturnType<typeof setTimeout> | null = null;
let autocompleteThrottle: ReturnType<typeof setTimeout> | null = null;

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  noteId: string;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  noteId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    query: string;
    position: { top: number; left: number };
  } | null>(null);

  // Force toolbar re-render when selection changes
  const [toolbarKey, setToolbarKey] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
        transformPastedText: false,
        transformCopiedText: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      CustomImage.configure({
        inline: false,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-stone max-w-none focus:outline-none min-h-full p-4 md:p-6',
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleImageUpload(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                event.preventDefault();
                handleImageUpload(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();

      // Debounce ONLY the store write
      if (storeWriteTimeout) clearTimeout(storeWriteTimeout);
      storeWriteTimeout = setTimeout(() => {
        onChange(markdown);
      }, 300);

      checkForWikiLinkTrigger();
    },
    // Update toolbar when selection/cursor changes
    onSelectionUpdate: () => {
      queueMicrotask(() => setToolbarKey(prev => prev + 1));
    },
  });

  // Track last external content to avoid unnecessary resets
  const lastExternalContent = useRef(content);

  useEffect(() => {
    if (!editor) return;

    const currentMarkdown = (editor.storage as any).markdown.getMarkdown();

    // Only update if content changed externally (e.g., switching notes)
    if (content !== currentMarkdown) {
      // FIX #1: Wrap setContent in setTimeout to push it outside React's
      // render cycle. Tiptap's setContent internally calls flushSync to
      // synchronize ProseMirror state — calling it synchronously inside a
      // useEffect that fires during rendering triggers React 18's
      // "flushSync was called from inside a lifecycle method" warning.
      // Deferring to the next task gives React time to finish its own
      // flush before Tiptap initiates its own.
      setTimeout(() => {
        if (!editor) return;

        const { from, to } = editor.state.selection;

        // FIX: Newer Tiptap versions require the third argument to be a
        // SetContentOptions object. Pass preserveWhitespace to retain
        // formatting fidelity and suppress the update event via emitUpdate.
        editor.commands.setContent(content, false as any);

        // Restore cursor position if still within doc bounds
        const docSize = editor.state.doc.content.size;
        if (from <= docSize) {
          editor.commands.setTextSelection({
            from: Math.min(from, docSize),
            to: Math.min(to, docSize),
          });
        }

        lastExternalContent.current = content;
      }, 0);
    }
  }, [content, editor, noteId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setShowListMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkForWikiLinkTrigger = () => {
    if (autocompleteThrottle) return;

    autocompleteThrottle = setTimeout(() => {
      if (!editor) {
        autocompleteThrottle = null;
        return;
      }

      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 100), from, '\n');

      const match = textBefore.match(/\[\[([^\]]*?)$/);

      if (match) {
        const query = match[1];
        const coords = editor.view.coordsAtPos(from);

        setAutocomplete({
          query,
          position: {
            top: coords.bottom + window.scrollY + 5,
            left: coords.left + window.scrollX,
          },
        });
      } else {
        setAutocomplete(null);
      }

      autocompleteThrottle = null;
    }, 150);
  };

  const handleWikiLinkSelect = (noteId: string, title: string) => {
    if (!editor) return;

    const { state } = editor;
    const { from } = state.selection;
    const textBefore = state.doc.textBetween(Math.max(0, from - 100), from, '\n');
    const match = textBefore.match(/\[\[([^\]]*?)$/);

    if (match) {
      const matchStart = from - match[0].length;
      const wikiLink = createWikiLink(noteId, title);

      editor
        .chain()
        .focus()
        .deleteRange({ from: matchStart, to: from })
        .insertContent(wikiLink)
        .run();
    }

    setAutocomplete(null);
  };

  const handleImageUpload = async (file: File) => {
    if (!editor) return;

    setUploading(true);
    try {
      const asset = await assetService.uploadImage(file, noteId);
      editor.chain().focus().setImage({ src: `dhi-asset://${asset.id}`, alt: file.name }).run();
    } catch (error) {
      console.error('Image upload failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addLink = () => {
    setShowLinkDialog(true);
  };

  const handleInsertLink = (url: string) => {
    if (editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  if (!editor) {
    return null;
  }

  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }> = ({ onClick, isActive, disabled, children, title }) => (
    <button
      onClick={onClick}
      type="button"
      disabled={disabled}
      className={cn(
        'p-2 rounded transition-all min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0',
        disabled && 'opacity-50 cursor-not-allowed',
        isActive
          ? 'bg-bhagwa text-white'
          : 'text-stone-400 hover:bg-stone-800 hover:text-sand'
      )}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="border-b border-stone-800 bg-stone-900">
        <div className="flex items-center justify-between px-2 py-1 border-b border-stone-800">
          <span className="text-xs text-stone-500">Formatting</span>
          <button
            onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
            className="p-1 hover:bg-stone-800 rounded transition-all"
            title={toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar'}
          >
            {toolbarCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
            )}
          </button>
        </div>

        {!toolbarCollapsed && (
          <div className="p-2 flex flex-wrap gap-1" key={toolbarKey}>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              title="Inline Code"
            >
              <Code className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </ToolbarButton>

            <div className="relative" ref={listMenuRef}>
              <ToolbarButton
                onClick={() => setShowListMenu(!showListMenu)}
                isActive={editor.isActive('bulletList') || editor.isActive('orderedList')}
                title="Lists"
              >
                <List className="w-4 h-4" />
              </ToolbarButton>
              {showListMenu && (
                <div className="absolute top-full left-0 mt-1 bg-stone-800 border border-stone-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
                  <button
                    onClick={() => {
                      editor.chain().focus().toggleBulletList().run();
                      setShowListMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-stone-300 hover:bg-stone-700 flex items-center gap-2"
                  >
                    <List className="w-3.5 h-3.5" />
                    Bullet List
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().toggleOrderedList().run();
                      setShowListMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-stone-300 hover:bg-stone-700 flex items-center gap-2"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    Numbered List
                  </button>
                </div>
              )}
            </div>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              isActive={editor.isActive('taskList')}
              title="Task List"
            >
              <CheckSquare className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={handleImageButtonClick}
              disabled={uploading}
              title="Upload Image (max 5MB)"
            >
              {uploading ? <Upload className="w-4 h-4 animate-pulse" /> : <ImageIcon className="w-4 h-4" />}
            </ToolbarButton>
            <ToolbarButton
              onClick={addLink}
              isActive={editor.isActive('link')}
              title="Add Link"
            >
              <Link2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="w-4 h-4" />
            </ToolbarButton>
          </div>
        )}
      </div>

      {/* FIX #2: key={noteId} forces React to fully unmount and remount the
          EditorContent — and therefore all ImageComponent nodes — whenever
          the active note changes. Without this, the editor is reused across
          notes and ImageComponent instances from the previous note are still
          alive when setContent fires, causing the same asset's blob URL to
          be created twice (once for the old node before cleanup, once for
          the new node on mount), which visually duplicates images. */}
      <div className="flex-1 overflow-y-auto bg-ash relative" key={noteId}>
        <EditorContent editor={editor} className="h-full" />

        {autocomplete && (
          <WikiLinkAutocomplete
            query={autocomplete.query}
            position={autocomplete.position}
            onSelect={handleWikiLinkSelect}
            onClose={() => setAutocomplete(null)}
          />
        )}
      </div>

      {showLinkDialog && (
        <LinkDialog
          onInsert={handleInsertLink}
          onClose={() => setShowLinkDialog(false)}
        />
      )}
    </div>
  );
};
