import React from 'react';
import { Link2, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Note } from '../../types/storage';

interface BacklinksProps {
  backlinks: Note[];
  onNoteClick: (noteId: string) => void;
  currentNoteId: string;
}

  // @ts-expect-error - currentNoteId passed from parent but not used internally
export const Backlinks: React.FC<BacklinksProps> = ({ backlinks, onNoteClick, currentNoteId }) => {
  if (backlinks.length === 0) {
    return (
      <div className="p-3 border-b border-stone-800 bg-stone-900">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-3.5 h-3.5 text-bhagwa" />
          <span className="text-xs text-stone-400 font-medium">Backlinks</span>
        </div>
        <p className="text-xs text-stone-500 italic">No notes link here yet</p>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-stone-800 bg-stone-900">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-3.5 h-3.5 text-bhagwa" />
        <span className="text-xs text-stone-400 font-medium">Backlinks</span>
        <span className="text-xs text-stone-600 bg-stone-800 px-1.5 py-0.5 rounded">
          {backlinks.length}
        </span>
      </div>

      <div className="space-y-1">
        {backlinks.map((note) => (
          <button
            key={note.id}
            onClick={() => onNoteClick(note.id)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-lg transition-all group flex items-center gap-2',
              'hover:bg-stone-800 border border-transparent hover:border-stone-700'
            )}
          >
            <ChevronRight className="w-3 h-3 text-stone-600 group-hover:text-bhagwa transition-colors flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-sand truncate group-hover:text-bhagwa transition-colors">
                {note.title}
              </div>
              {note.content && (
                <div className="text-xs text-stone-500 truncate mt-0.5">
                  {note.content.slice(0, 60)}...
                </div>
              )}
            </div>
            <span className="text-xs text-stone-600 flex-shrink-0">
              {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
