import React, { useState } from 'react';
import { X, Link2 } from 'lucide-react';

interface LinkDialogProps {
  onInsert: (url: string) => void;
  onClose: () => void;
}

export const LinkDialog: React.FC<LinkDialogProps> = ({ onInsert, onClose }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onInsert(url.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="card max-w-md w-full shadow-2xl border-stone-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-bhagwa" />
            <h3 className="text-base font-semibold text-sand">Insert Link</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded transition-all">
            <X className="w-4 h-4 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="input-base w-full mb-4"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!url.trim()}>
              Insert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
