import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, Edit2, FileText, GripVertical } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Folder as FolderType, Note } from '../../types/storage';

interface FolderTreeProps {
  folders: FolderType[];
  notes: Note[];
  selectedFolderId?: string;
  currentNoteId?: string;
  onFolderSelect: (folderId: string | undefined) => void;
  onNoteSelect: (noteId: string) => void;
  onRequestCreateChild: (parentId?: string) => void;
  onRequestDelete: (folderId: string) => void;
  onRequestRename: (folderId: string, currentName: string) => void;
  onMoveNote: (noteId: string, targetFolderId: string | undefined) => void;
}

interface TreeNodeProps extends FolderTreeProps {
  folder: FolderType;
  level: number;
}

// 🔥 OPTIMIZED: Memoized TreeNode with custom comparison
const TreeNodeRaw: React.FC<TreeNodeProps> = ({
  folder,
  level,
  folders,
  notes,
  selectedFolderId,
  currentNoteId,
  onFolderSelect,
  onNoteSelect,
  onRequestCreateChild,
  onRequestDelete,
  onRequestRename,
  onMoveNote,
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [showActions, setShowActions] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 🔥 OPTIMIZED: Memoize expensive filters
  const children = React.useMemo(
    () => folders.filter(f => f.parentId === folder.id),
    [folders, folder.id]
  );

  const folderNotes = React.useMemo(
    () => notes.filter(n => n.folderId === folder.id),
    [notes, folder.id]
  );

  const hasChildren = children.length > 0;
  const hasNotes = folderNotes.length > 0;
  const indent = level * 20;
  const isSelected = selectedFolderId === folder.id;

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      onMoveNote(noteId, folder.id);
    }
  };

  return (
    <div>
      {/* Folder Row */}
      <div
        className={cn(
          'group flex items-center gap-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer',
          'hover:bg-stone-800',
          isSelected && 'bg-bhagwa/10 border border-bhagwa/20',
          isDragOver && 'bg-blue-900/20 border border-blue-500'
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse */}
        {(hasChildren || hasNotes) ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-stone-700 rounded flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Folder Icon */}
        <div className="flex-shrink-0">
          {(hasChildren || hasNotes) && isExpanded ? (
            <FolderOpen className="w-4 h-4 text-bhagwa" />
          ) : (
            <Folder className="w-4 h-4 text-stone-400" />
          )}
        </div>

        {/* Folder Name */}
        <div onClick={() => onFolderSelect(folder.id)} className="flex-1 text-sm text-sand truncate">
          {folder.name}
        </div>

        {/* Note Count Badge */}
        {folderNotes.length > 0 && (
          <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded">
            {folderNotes.length}
          </span>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestCreateChild(folder.id);
              }}
              className="p-1 hover:bg-stone-700 rounded"
              title="New subfolder"
            >
              <Plus className="w-3 h-3 text-stone-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestRename(folder.id, folder.name);
              }}
              className="p-1 hover:bg-stone-700 rounded"
              title="Rename"
            >
              <Edit2 className="w-3 h-3 text-stone-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(folder.id);
              }}
              className="p-1 hover:bg-red-900/50 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        )}

        {/* Depth Warning */}
        {level >= 3 && (
          <span className="text-xs text-orange-400 ml-2" title="Deep nesting not recommended">⚠️</span>
        )}
      </div>

      {/* Expanded Content - Notes and Subfolders */}
      {isExpanded && (
        <div>
          {/* Notes in this folder */}
          {folderNotes.map(note => (
            <div
              key={note.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('noteId', note.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onNoteSelect(note.id)}
              className={cn(
                'flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all cursor-move group/note',
                'hover:bg-stone-800',
                currentNoteId === note.id && 'bg-bhagwa/10 border border-bhagwa/20'
              )}
              style={{ paddingLeft: `${indent + 32}px` }}
            >
              <GripVertical className="w-3 h-3 text-stone-600 opacity-0 group-hover/note:opacity-100 transition-opacity flex-shrink-0" />
              <FileText className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" />
              <span className="text-xs text-stone-300 truncate flex-1">{note.title}</span>
            </div>
          ))}

          {/* Subfolders */}
          {children.map(child => (
            <TreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              folders={folders}
              notes={notes}
              selectedFolderId={selectedFolderId}
              currentNoteId={currentNoteId}
              onFolderSelect={onFolderSelect}
              onNoteSelect={onNoteSelect}
              onRequestCreateChild={onRequestCreateChild}
              onRequestDelete={onRequestDelete}
              onRequestRename={onRequestRename}
              onMoveNote={onMoveNote}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 🔥 CRITICAL: Memoization with shallow comparison
const TreeNode = React.memo(TreeNodeRaw, (prev, next) => {
  return (
    prev.folder.id === next.folder.id &&
    prev.folder.name === next.folder.name &&
    prev.selectedFolderId === next.selectedFolderId &&
    prev.currentNoteId === next.currentNoteId &&
    prev.folders.length === next.folders.length &&
    prev.notes.length === next.notes.length
  );
});

export const FolderTree: React.FC<FolderTreeProps> = (props) => {
  // @ts-expect-error - Used via spread operator {...props} on line 304
  const { folders, notes, selectedFolderId, currentNoteId, onFolderSelect, onNoteSelect, onRequestCreateChild, onMoveNote } = props;
  
  // 🔥 OPTIMIZED: Memoize root folders
  const rootFolders = React.useMemo(
    () => folders.filter(f => !f.parentId),
    [folders]
  );

  const unfiledNotes = React.useMemo(
    () => notes.filter(n => !n.folderId),
    [notes]
  );

  const [isDragOver, setIsDragOver] = useState(false);

  // Handle drop on "All Notes" section
  const handleDropOnAllNotes = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      onMoveNote(noteId, undefined);
    }
  };

  return (
    <div className="py-2">
      {/* All Notes */}
      <div
        onClick={() => onFolderSelect(undefined)}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={handleDropOnAllNotes}
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all cursor-pointer mb-1',
          'hover:bg-stone-800',
          selectedFolderId === undefined && 'bg-bhagwa/10 border border-bhagwa/20',
          isDragOver && 'bg-blue-900/20 border border-blue-500'
        )}
      >
        <Folder className="w-4 h-4 text-stone-400" />
        <span className="text-sm text-sand flex-1">All Notes</span>
        {unfiledNotes.length > 0 && (
          <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded">
            {unfiledNotes.length}
          </span>
        )}
      </div>

      {/* Root Folders */}
      {rootFolders.map(folder => (
        <TreeNode key={folder.id} folder={folder} level={0} {...props} />
      ))}

      {/* New Folder Button */}
      <button
        onClick={() => onRequestCreateChild(undefined)}
        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all mt-2 hover:bg-stone-800 text-stone-400 hover:text-sand"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">New Folder</span>
      </button>
    </div>
  );
};
