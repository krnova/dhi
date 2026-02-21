import React, { useState, useEffect, useRef } from 'react';
import { Download, FileArchive, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  downloadFullBackup,
  downloadMarkdownArchive,
  getLastBackupMessage,
  shouldRecommendBackup,
  parseImportFile,
  executeImport,
  type ExportProgress,
} from '../../services/ImportExportService';
import type { ImportPlan, ImportResult } from '../../types/storage';
import { ImportPreviewModal } from './ImportPreviewModal';
import { ImportProgressModal, type ImportProgressState } from './ImportProgressModal';
import { ImportResultModal } from './ImportResultModal';

export const DataManagementSection: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [lastBackup, setLastBackup] = useState<string>('Loading...');
  const [needsBackup, setNeedsBackup] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import state machine
  type ImportStage = 'idle' | 'parsing' | 'preview' | 'importing' | 'result';
  const [importStage, setImportStage] = useState<ImportStage>('idle');
  const [importPlan, setImportPlan] = useState<ImportPlan | null>(null);
  const [importFilename, setImportFilename] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    stage: 'folders',
    current: 0,
    total: 0,
    notesImported: 0,
    foldersCreated: 0,
    assetsImported: 0,
    message: 'Starting...',
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadBackupInfo = async () => {
      const message = await getLastBackupMessage();
      const shouldRecommend = await shouldRecommendBackup();
      setLastBackup(message);
      setNeedsBackup(shouldRecommend);
    };
    loadBackupInfo();
  }, [exportSuccess]);

  // ─── Export handlers ───────────────────────────────────────────────────────

  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);
    setExportSuccess(false);
    try {
      await downloadFullBackup((progress) => setExportProgress(progress));
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);
    setExportSuccess(false);
    try {
      await downloadMarkdownArchive((progress) => setExportProgress(progress));
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // ─── Import flow ───────────────────────────────────────────────────────────

  const handleImportClick = () => {
    setImportParseError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFilename(file.name);
    setImportStage('parsing');
    setImportParseError(null);

    try {
      const plan = await parseImportFile(file);
      setImportPlan(plan);
      setImportStage('preview');
    } catch (error) {
      setImportParseError(error instanceof Error ? error.message : 'Failed to parse file');
      setImportStage('idle');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async (restoreSettings: boolean) => {
    if (!importPlan) return;

    setImportStage('importing');

    // Build a progress-aware execute wrapper
    const progressTracker: ImportProgressState = {
      stage: 'folders',
      current: 0,
      total: importPlan.folders.length + importPlan.assets.length + importPlan.notes.length,
      notesImported: 0,
      foldersCreated: 0,
      assetsImported: 0,
      message: 'Restoring folders...',
    };
    setImportProgress({ ...progressTracker });

    try {
      // Phase 1 – folders
      setImportProgress(p => ({ ...p, stage: 'folders', message: 'Restoring folders...' }));
      await new Promise(r => setTimeout(r, 50)); // let UI update

      // Phase 2 – assets (progress update mid-way)
      setImportProgress(p => ({
        ...p,
        stage: 'assets',
        current: importPlan.folders.length,
        message: `Importing ${importPlan.assets.length} image${importPlan.assets.length !== 1 ? 's' : ''}...`,
      }));
      await new Promise(r => setTimeout(r, 50));

      // Phase 3 – notes
      setImportProgress(p => ({
        ...p,
        stage: 'notes',
        current: importPlan.folders.length + importPlan.assets.length,
        message: `Importing ${importPlan.notes.length} note${importPlan.notes.length !== 1 ? 's' : ''}...`,
      }));
      await new Promise(r => setTimeout(r, 50));

      // Execute
      const result = await executeImport(importPlan, restoreSettings);

      setImportProgress(p => ({
        ...p,
        stage: 'finalizing',
        current: p.total,
        notesImported: result.notesImported,
        foldersCreated: result.foldersCreated,
        assetsImported: result.assetsImported,
        message: 'Finishing up...',
      }));

      await new Promise(r => setTimeout(r, 300));

      setImportResult(result);
      setImportStage('result');
    } catch (error) {
      const errorResult: ImportResult = {
        success: false,
        notesImported: 0,
        notesSkipped: 0,
        notesRegenerated: 0,
        foldersCreated: 0,
        assetsImported: 0,
        conflicts: importPlan.conflicts,
        warnings: importPlan.warnings,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        settingsRestored: false,
      };
      setImportResult(errorResult);
      setImportStage('result');
    }
  };

  const handleViewNotes = () => {
    // Reload to reflect new notes in sidebar
    window.location.reload();
  };

  const handleResultClose = () => {
    if (importResult?.success) {
      // Reload after successful import so notes appear
      setTimeout(() => window.location.reload(), 100);
    } else {
      setImportStage('idle');
      setImportPlan(null);
      setImportResult(null);
    }
  };

  const isParsing = importStage === 'parsing';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
          <Download className="w-4 h-4 text-bhagwa" />
          <h2 className="text-heading text-base">Data Management</h2>
        </div>

        {/* Backup warning */}
        {needsBackup && !exportSuccess && (
          <div className="p-3 rounded-lg bg-orange-900/10 border border-orange-900/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-400">Backup Recommended</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {lastBackup === 'Never'
                  ? "You haven't backed up your notes yet. Create a backup to ensure your data is safe."
                  : `Last backup was ${lastBackup}. Regular backups protect your work.`}
              </p>
            </div>
          </div>
        )}

        {/* Export success */}
        {exportSuccess && (
          <div className="p-3 rounded-lg bg-green-900/10 border border-green-900/30 flex items-start gap-2 animate-in">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-400">Export Successful</p>
              <p className="text-xs text-stone-400 mt-0.5">
                Your backup has been saved to your{' '}
                <span className="font-medium text-stone-300">
                  {typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()
                    ? 'Documents'
                    : 'Downloads'}
                </span>{' '}
                folder.
              </p>
            </div>
          </div>
        )}

        {/* Export error */}
        {exportError && (
          <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">Export Failed</p>
              <p className="text-xs text-stone-400 mt-0.5">{exportError}</p>
            </div>
          </div>
        )}

        {/* Parse error (inline, not modal) */}
        {importParseError && (
          <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">Could Not Read File</p>
              <p className="text-xs text-stone-400 mt-0.5">{importParseError}</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Export section */}
          <div>
            <label className="text-sm font-medium text-sand block mb-2">Export Your Notes</label>

            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all text-left mb-2',
                isExporting
                  ? 'border-stone-700 bg-stone-800/50 cursor-not-allowed opacity-60'
                  : 'border-bhagwa bg-bhagwa/5 hover:bg-bhagwa/10'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-bhagwa/10 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-bhagwa" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-sand">Full Backup (JSON)</div>
                  <div className="text-xs text-stone-400 mt-0.5">Complete fidelity • Recommended</div>
                  {isExporting && exportProgress && exportProgress.stage !== 'complete' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                        <span>{exportProgress.message}</span>
                        <span>{exportProgress.percent}%</span>
                      </div>
                      <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-bhagwa transition-all duration-300"
                          style={{ width: `${exportProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </button>

            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all text-left',
                isExporting
                  ? 'border-stone-700 bg-stone-800/50 cursor-not-allowed opacity-60'
                  : 'border-stone-700 bg-stone-800/50 hover:border-stone-600 hover:bg-stone-800'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-700/50 flex items-center justify-center flex-shrink-0">
                  <FileArchive className="w-5 h-5 text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-sand">Markdown Archive</div>
                  <div className="text-xs text-stone-400 mt-0.5">Portable • Human-readable</div>
                </div>
              </div>
            </button>
          </div>

          {/* Last backup info */}
          <div className="p-3 rounded-lg bg-stone-800/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-400">Last backup:</span>
              <span className={cn('font-medium', needsBackup ? 'text-orange-400' : 'text-stone-300')}>
                {lastBackup}
              </span>
            </div>
          </div>

          {/* Import section */}
          <div>
            <label className="text-sm font-medium text-sand block mb-2">Import Notes</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json,.md,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={isParsing}
              className={cn(
                'w-full p-3 rounded-lg border-2 transition-all text-left',
                isParsing
                  ? 'border-stone-700 bg-stone-800/50 cursor-not-allowed opacity-60'
                  : 'border-stone-700 bg-stone-800/50 hover:border-stone-600 hover:bg-stone-800'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-700/50 flex items-center justify-center flex-shrink-0">
                  <FileArchive className="w-5 h-5 text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-sand">
                    {isParsing ? 'Reading file...' : 'Choose Files...'}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    DHI backup, Markdown archive, or single .md file
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="p-3 rounded-lg bg-stone-800/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-stone-500 leading-relaxed">
              All data is stored locally on your device. Backups are saved to your{' '}
              <span className="font-medium text-stone-400">
                {typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()
                  ? 'Documents'
                  : 'Downloads'}
              </span>{' '}
              folder. For maximum safety, keep backups in multiple locations.
            </div>
          </div>
        </div>
      </section>

      {/* ── Import modals ── */}
      {importPlan && (
        <ImportPreviewModal
          isOpen={importStage === 'preview'}
          plan={importPlan}
          filename={importFilename}
          onConfirm={handleConfirmImport}
          onCancel={() => {
            setImportStage('idle');
            setImportPlan(null);
          }}
        />
      )}

      <ImportProgressModal
        isOpen={importStage === 'importing'}
        progress={importProgress}
      />

      {importResult && (
        <ImportResultModal
          isOpen={importStage === 'result'}
          result={importResult}
          onViewNotes={handleViewNotes}
          onClose={handleResultClose}
        />
      )}
    </>
  );
};
