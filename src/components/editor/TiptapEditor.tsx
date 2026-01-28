  // Tiptap Editor with Wiki Link Support
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
    const [autocomplete, setAutocomplete] = useState<{
      query: string;
      position: { top: number; left: number };
    } | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        Markdown,
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
        handleDrop: (view, event, slice, moved) => {
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
        handlePaste: (view, event) => {
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
        // Debug Log: Confirm the URL is present in the markdown
        console.log('Markdown output:', markdown);
        onChange(markdown);
        checkForWikiLinkTrigger();
      },
    });

    useEffect(() => {
      if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
        editor.commands.setContent(content);
      }
    }, [content, editor]);

    const checkForWikiLinkTrigger = () => {
      if (!editor) return;

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
            <div className="p-2 flex flex-wrap gap-1">
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
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </ToolbarButton>
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

        <div className="flex-1 overflow-y-auto bg-ash relative">
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
