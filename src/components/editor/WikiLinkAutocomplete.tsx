  // Wiki Link Autocomplete Component
  import React, { useState, useEffect, useRef } from 'react';
  import { useNotesStore } from '../../stores/notesStore';
  import { cn } from '../../utils/cn';
  import { FileText } from 'lucide-react';

  interface WikiLinkAutocompleteProps {
    query: string;
    position: { top: number; left: number };
    onSelect: (noteId: string, title: string) => void;
    onClose: () => void;
  }

  export const WikiLinkAutocomplete: React.FC<WikiLinkAutocompleteProps> = ({
    query,
    position,
    onSelect,
    onClose,
  }) => {
    const { notes, currentNoteId } = useNotesStore();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter notes (exclude current note)
    const filteredNotes = notes
      .filter(note => note.id !== currentNoteId)
      .filter(note =>
        note.title.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10);

    useEffect(() => {
      setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filteredNotes.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredNotes.length) % filteredNotes.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredNotes[selectedIndex]) {
            onSelect(filteredNotes[selectedIndex].id, filteredNotes[selectedIndex].title);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredNotes, selectedIndex, onSelect, onClose]);

    if (filteredNotes.length === 0) {
      return null;
    }

    return (
      <div
        ref={containerRef}
        className="fixed bg-stone-900 border border-stone-700 rounded-lg shadow-xl py-1 z-50 max-h-64 overflow-y-auto"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: '200px',
          maxWidth: '300px',
        }}
      >
        {filteredNotes.map((note, index) => (
          <button
            key={note.id}
            onClick={() => onSelect(note.id, note.title)}
            className={cn(
              'w-full text-left px-3 py-2 flex items-center gap-2 transition-all',
              index === selectedIndex
                ? 'bg-bhagwa/10 text-bhagwa'
                : 'text-stone-300 hover:bg-stone-800'
            )}
          >
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-sm">{note.title}</span>
          </button>
        ))}
      </div>
    );
  };
