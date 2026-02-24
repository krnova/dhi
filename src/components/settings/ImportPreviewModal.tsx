import React, { useState } from 'react';
import {
  X,
  FileArchive,
  FileText,
  Folder,
  Image as ImageIcon,
  AlertTriangle,
  SkipForward,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ImportPlan } from '../../types/storage';

interface ImportPreviewModalProps {
  isOpen: boolean;
  plan: ImportPlan;
  filename: string;
  onConfirm: (restoreSettings: boolean) => void;
  onCancel: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  plan,
  filename,
  onConfirm,
  onCancel,
}) => {
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  if (!isOpen) return null;

  const skipConflicts = plan.conflicts.filter(c => c.action === 'skip');
  const regenerateConflicts = plan.conflicts.filter(c => c.action === 'regenerate');
  const missingAssetWarnings = plan.warnings.filter(w => w.type === 'missing_asset');
  const otherWarnings = plan.warnings.filter(w => w.type !== 'missing_asset');

  const totalSizeMB = (plan.totalSize / (1024 * 1024)).toFixed(1);
  const hasIssues = plan.conflicts.length > 0 || plan.warnings.length > 0;

  const sourceLabel = {
    'dhi-json': 'DHI Backup',
    'dhi-markdown': 'DHI Markdown Archive',
    'external-markdown': 'External Markdown',
  }[plan.source];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-bhagwa/10 flex items-center justify-center flex-shrink-0">
              <FileArchive className="w-5 h-5 text-bhagwa" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-sand">Import Preview</h2>
              <p className="text-xs text-stone-500 truncate mt-0.5">{filename}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-stone-800 rounded transition-all flex-shrink-0"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Source badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-stone-400 bg-stone-800 px-2 py-1 rounded">
              {sourceLabel}
            </span>
          </div>

          {/* What was found */}
          <div className="bg-stone-800/40 rounded-lg p-4 space-y-2.5">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Found</p>

            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-stone-300">
                <span className="font-semibold text-sand">{plan.notes.length}</span> note{plan.notes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {plan.folders.length > 0 && (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-stone-300">
                  <span className="font-semibold text-sand">{plan.folders.length}</span> folder{plan.folders.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {plan.assets.length > 0 && (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-stone-300">
                  <span className="font-semibold text-sand">{plan.assets.length}</span> image{plan.assets.length !== 1 ? 's' : ''}
                  {plan.totalSize > 0 && (
                    <span className="text-stone-500 ml-1">({totalSizeMB} MB)</span>
                  )}
                </span>
              </div>
            )}

            {plan.containsSettings && (
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-stone-300">Settings backup included</span>
              </div>
            )}
          </div>

          {/* Conflicts section */}
          {plan.conflicts.length > 0 && (
            <div className="border border-orange-900/40 bg-orange-900/5 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowConflicts(!showConflicts)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-orange-900/10 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-orange-400">
                    {plan.conflicts.length} conflict{plan.conflicts.length !== 1 ? 's' : ''} detected
                  </span>
                </div>
                {showConflicts ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </button>

              {showConflicts && (
                <div className="border-t border-orange-900/30 divide-y divide-stone-800">
                  {skipConflicts.length > 0 && (
                    <div className="p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <SkipForward className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-xs font-medium text-stone-400">
                          {skipConflicts.length} note{skipConflicts.length !== 1 ? 's' : ''} already exist — will skip
                        </span>
                      </div>
                      <div className="space-y-1 pl-5">
                        {/* key uses oldId which is a unique identifier per conflict */}
                        {skipConflicts.slice(0, 5).map(c => (
                          <p key={c.oldId} className="text-xs text-stone-500 truncate">
                            • {c.title}
                          </p>
                        ))}
                        {skipConflicts.length > 5 && (
                          <p className="text-xs text-stone-600">+{skipConflicts.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {regenerateConflicts.length > 0 && (
                    <div className="p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-stone-400">
                          {regenerateConflicts.length} note{regenerateConflicts.length !== 1 ? 's' : ''} have ID conflicts — new IDs will be generated
                        </span>
                      </div>
                      <div className="space-y-1 pl-5">
                        {/* key uses oldId which is a unique identifier per conflict */}
                        {regenerateConflicts.slice(0, 5).map(c => (
                          <p key={c.oldId} className="text-xs text-stone-500 truncate">
                            • {c.title}
                          </p>
                        ))}
                        {regenerateConflicts.length > 5 && (
                          <p className="text-xs text-stone-600">+{regenerateConflicts.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Warnings section */}
          {plan.warnings.length > 0 && (
            <div className="border border-yellow-900/40 bg-yellow-900/5 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-yellow-900/10 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-yellow-500">
                    {plan.warnings.length} warning{plan.warnings.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {showWarnings ? (
                  <ChevronUp className="w-4 h-4 text-stone-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-500" />
                )}
              </button>

              {showWarnings && (
                <div className="border-t border-yellow-900/30 p-3.5 space-y-2">
                  {missingAssetWarnings.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-stone-400 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {missingAssetWarnings.length} missing image{missingAssetWarnings.length !== 1 ? 's' : ''} — notes will have broken references
                      </p>
                      <div className="space-y-0.5 pl-4">
                        {missingAssetWarnings.slice(0, 3).map((w, i) => (
                          // Prefix with "missing-" namespace to guarantee no collision with otherWarnings keys
                          <p key={`missing-${i}`} className="text-xs text-stone-500 truncate">• {w.message}</p>
                        ))}
                        {missingAssetWarnings.length > 3 && (
                          <p className="text-xs text-stone-600">+{missingAssetWarnings.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                  {otherWarnings.map((w, i) => (
                    // Prefix with "other-" namespace to guarantee no collision with missingAssetWarnings keys
                    <p key={`other-${i}`} className="text-xs text-stone-500">• {w.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings restore option */}
          {plan.containsSettings && (
            <button
              onClick={() => setRestoreSettings(!restoreSettings)}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all text-left',
                restoreSettings
                  ? 'border-bhagwa/50 bg-bhagwa/5'
                  : 'border-stone-700 bg-stone-800/30 hover:border-stone-600'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                restoreSettings ? 'bg-bhagwa border-bhagwa' : 'border-stone-500'
              )}>
                {restoreSettings && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-sm font-medium text-sand">Restore settings from backup</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">Theme, font size, tag palette, location, etc.</p>
              </div>
            </button>
          )}

          {/* Summary line */}
          {!hasIssues && (
            <div className="flex items-center gap-2 p-3 bg-green-900/10 border border-green-900/30 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400">No conflicts detected. Clean import ready.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-5 border-t border-stone-800">
          <button
            onClick={onCancel}
            className="btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(restoreSettings)}
            className="btn-primary flex-1"
          >
            Import {plan.notes.length > 0 ? `${plan.notes.length} Notes` : 'All'} →
          </button>
        </div>
      </div>
    </div>
  );
};
