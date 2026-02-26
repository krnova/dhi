import { createPortal } from 'react-dom';
import React, { useEffect } from 'react';
import { FileText, Folder, Image as ImageIcon, Loader2 } from 'lucide-react';

export interface ImportProgressState {
  stage: 'folders' | 'assets' | 'notes' | 'finalizing';
  current: number;
  total: number;
  notesImported: number;
  foldersCreated: number;
  assetsImported: number;
  message: string;
}

interface ImportProgressModalProps {
  isOpen: boolean;
  progress: ImportProgressState;
}

const STAGE_LABELS: Record<ImportProgressState['stage'], string> = {
  folders: 'Restoring folders...',
  assets: 'Importing images...',
  notes: 'Importing notes...',
  finalizing: 'Finalizing...',
};

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  isOpen,
  progress,
}) => {

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  
  if (!isOpen) return null;

  const percent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">

        {/* Spinner + title */}
        <div className="flex items-center gap-3 mb-5">
          <Loader2 className="w-5 h-5 text-bhagwa animate-spin flex-shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-sand">Importing...</h2>
            <p className="text-xs text-stone-500 mt-0.5">{STAGE_LABELS[progress.stage]}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
            <span>{progress.message}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-bhagwa rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress.total > 0 && (
            <p className="text-xs text-stone-600 mt-1 text-right">
              {progress.current} / {progress.total}
            </p>
          )}
        </div>

        {/* Live counters */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-stone-800/40 rounded-lg p-2.5 text-center">
            <FileText className="w-3.5 h-3.5 text-bhagwa mx-auto mb-1" />
            <div className="text-sm font-semibold text-sand">{progress.notesImported}</div>
            <div className="text-xs text-stone-500">Notes</div>
          </div>
          <div className="bg-stone-800/40 rounded-lg p-2.5 text-center">
            <Folder className="w-3.5 h-3.5 text-stone-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-sand">{progress.foldersCreated}</div>
            <div className="text-xs text-stone-500">Folders</div>
          </div>
          <div className="bg-stone-800/40 rounded-lg p-2.5 text-center">
            <ImageIcon className="w-3.5 h-3.5 text-stone-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-sand">{progress.assetsImported}</div>
            <div className="text-xs text-stone-500">Images</div>
          </div>
        </div>

        <p className="text-xs text-stone-600 text-center mt-4">Please don't close the app...</p>
      </div>
    </div>,
    document.body
  );
};
