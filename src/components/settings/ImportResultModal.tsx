import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  FileText,
  Folder,
  Image as ImageIcon,
  Settings,
  SkipForward,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import type { ImportResult } from '../../types/storage';

interface ImportResultModalProps {
  isOpen: boolean;
  result: ImportResult;
  onViewNotes: () => void;
  onClose: () => void;
}

export const ImportResultModal: React.FC<ImportResultModalProps> = ({
  isOpen,
  result,
  onViewNotes,
  onClose,
}) => {
  if (!isOpen) return null;

  const hasWarnings = result.warnings.length > 0;
  const hasErrors = result.errors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${result.success ? 'bg-green-900/30' : 'bg-red-900/20'}`}>
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-sand">
                {result.success ? 'Import Complete' : 'Import Failed'}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {result.success
                  ? hasWarnings ? 'Completed with warnings' : 'Everything imported successfully'
                  : 'An error occurred during import'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-800 rounded transition-all flex-shrink-0"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Success stats */}
          {result.success && (
            <div className="grid grid-cols-2 gap-2">
              {result.notesImported > 0 && (
                <div className="bg-stone-800/40 rounded-lg p-3 flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-bhagwa flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-sand">{result.notesImported}</div>
                    <div className="text-xs text-stone-500">Notes imported</div>
                  </div>
                </div>
              )}
              {result.foldersCreated > 0 && (
                <div className="bg-stone-800/40 rounded-lg p-3 flex items-center gap-2.5">
                  <Folder className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-sand">{result.foldersCreated}</div>
                    <div className="text-xs text-stone-500">Folders created</div>
                  </div>
                </div>
              )}
              {result.assetsImported > 0 && (
                <div className="bg-stone-800/40 rounded-lg p-3 flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-sand">{result.assetsImported}</div>
                    <div className="text-xs text-stone-500">Images restored</div>
                  </div>
                </div>
              )}
              {result.settingsRestored && (
                <div className="bg-stone-800/40 rounded-lg p-3 flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-sand">Done</div>
                    <div className="text-xs text-stone-500">Settings restored</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skipped / Regenerated info */}
          {(result.notesSkipped > 0 || result.notesRegenerated > 0) && (
            <div className="space-y-1.5">
              {result.notesSkipped > 0 && (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <SkipForward className="w-3.5 h-3.5 flex-shrink-0" />
                  {result.notesSkipped} note{result.notesSkipped !== 1 ? 's' : ''} skipped (already existed)
                </div>
              )}
              {result.notesRegenerated > 0 && (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                  {result.notesRegenerated} note{result.notesRegenerated !== 1 ? 's' : ''} imported with new IDs (conflict resolved)
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="border border-yellow-900/30 bg-yellow-900/5 rounded-lg p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-xs font-medium text-yellow-500">
                  {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}
                </span>
              </div>
              {result.warnings.slice(0, 4).map((w, i) => (
                <p key={i} className="text-xs text-stone-400 pl-5">• {w.message}</p>
              ))}
              {result.warnings.length > 4 && (
                <p className="text-xs text-stone-600 pl-5">+{result.warnings.length - 4} more</p>
              )}
            </div>
          )}

          {/* Errors */}
          {hasErrors && (
            <div className="border border-red-900/30 bg-red-900/5 rounded-lg p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">Errors</span>
              </div>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-stone-400 pl-5">• {e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-5 border-t border-stone-800">
          <button onClick={onClose} className="btn-ghost flex-1">
            Close
          </button>
          {result.success && result.notesImported + result.notesRegenerated > 0 && (
            <button
              onClick={() => { onViewNotes(); onClose(); }}
              className="btn-primary flex-1"
            >
              View Notes
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
