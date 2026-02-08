import React from 'react';
import { Folder, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Folder as FolderType } from '../../types/storage';

interface NoteMoveMenuProps {
  isOpen: boolean;
  anchorRef?: React.RefObject<HTMLDivElement>;
  position?: { x: number; y: number };
  folders: FolderType[];
  currentFolderId?: string;
  onMove: (folderId: string | undefined) => void;
  onClose: () => void;
}

export const NoteMoveMenu: React.FC<NoteMoveMenuProps> = ({
  isOpen,
  anchorRef,
  position,
  folders,
  currentFolderId,
  onMove,
  onClose,
}) => {
  if (!isOpen) return null;

  // Compute position: either from an anchor element, or fallback to explicit coordinates
  let style: React.CSSProperties = {};
  if (anchorRef?.current) {
    const rect = anchorRef.current.getBoundingClientRect();
    style = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${Math.min(rect.left, window.innerWidth - 220)}px`,
      zIndex: 50,
    };
  } else if (position) {
    style = {
      position: 'fixed',
      top: `${position.y}px`,
      left: `${Math.min(position.x, window.innerWidth - 220)}px`,
      zIndex: 50,
    };
  }

  const renderFolder = (folder: FolderType, level: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id);
    const indent = level * 16;

    return (
      <div key={folder.id}>
        <button
          onClick={() => {
            onMove(folder.id);
            onClose();
          }}
          disabled={currentFolderId === folder.id}
          className={cn(
            'w-full text-left py-2 text-sm transition-all flex items-center gap-2',
            currentFolderId === folder.id
              ? 'text-stone-600 cursor-not-allowed'
              : 'text-stone-300 hover:bg-stone-800'
          )}
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
          {currentFolderId === folder.id && <span className="text-xs text-stone-600">here</span>}
        </button>
        {children.map(child => renderFolder(child, level + 1))}
      </div>
    );
  };

  const rootFolders = folders.filter(f => !f.parentId);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu */}
      <div
        className="bg-stone-900 border border-stone-700 rounded-lg shadow-xl py-1 min-w-[200px] max-w-[260px] max-h-[360px] overflow-y-auto"
        style={style}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800">
          <span className="text-xs font-medium text-stone-400">Move to</span>
          <button onClick={onClose} className="p-0.5 hover:bg-stone-800 rounded">
            <X className="w-3 h-3 text-stone-500" />
          </button>
        </div>

        {/* No Folder Option */}
        <button
          onClick={() => {
            onMove(undefined);
            onClose();
          }}
          disabled={currentFolderId === undefined}
          className={cn(
            'w-full text-left px-3 py-2 text-sm transition-all flex items-center gap-2',
            currentFolderId === undefined
              ? 'text-stone-600 cursor-not-allowed'
              : 'text-stone-300 hover:bg-stone-800'
          )}
        >
          <Folder className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">No Folder</span>
          {currentFolderId === undefined && <span className="text-xs text-stone-600">here</span>}
        </button>

        {/* Folder Tree */}
        {rootFolders.map(folder => renderFolder(folder))}

        {/* Empty State */}
        {folders.length === 0 && (
          <div className="px-3 py-5 text-center text-xs text-stone-500">
            No folders yet
          </div>
        )}
      </div>
    </>
  );
};
