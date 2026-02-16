import React, { useState, useEffect } from 'react';
import { Download, FileArchive, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  downloadFullBackup,
  downloadMarkdownArchive,
  getLastBackupMessage,
  shouldRecommendBackup,
  type ExportProgress
} from '../../services/ImportExportService';

export const DataManagementSection: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [lastBackup, setLastBackup] = useState<string>('Loading...');
  const [needsBackup, setNeedsBackup] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load last backup info
  useEffect(() => {
    const loadBackupInfo = async () => {
      const message = await getLastBackupMessage();
      const shouldRecommend = await shouldRecommendBackup();
      setLastBackup(message);
      setNeedsBackup(shouldRecommend);
    };
    loadBackupInfo();
  }, [exportSuccess]); // Reload after successful export

  const handleExportJSON = async () => {
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);
    setExportSuccess(false);

    try {
      await downloadFullBackup((progress) => {
        setExportProgress(progress);
      });
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000); // Clear after 3s
    } catch (error) {
      console.error('Export failed:', error);
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
      await downloadMarkdownArchive((progress) => {
        setExportProgress(progress);
      });
      
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Markdown export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-stone-800">
        <Download className="w-4 h-4 text-bhagwa" />
        <h2 className="text-heading text-base">Data Management</h2>
      </div>

      {/* Backup Warning */}
      {needsBackup && !exportSuccess && (
        <div className="p-3 rounded-lg bg-orange-900/10 border border-orange-900/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-400">Backup Recommended</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {lastBackup === 'Never' 
                ? 'You haven\'t backed up your notes yet. Create a backup to ensure your data is safe.'
                : `Last backup was ${lastBackup}. Regular backups protect your work.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {exportSuccess && (
        <div className="p-3 rounded-lg bg-green-900/10 border border-green-900/30 flex items-start gap-2 animate-in">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400">Export Successful</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Your backup has been downloaded. Check your Downloads folder.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {exportError && (
        <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/30 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-400">Export Failed</p>
            <p className="text-xs text-stone-400 mt-0.5">{exportError}</p>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-sand block mb-2">Export Your Notes</label>
          
          {/* Full Backup Button */}
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
                <div className="text-xs text-stone-400 mt-0.5">
                  Complete fidelity • Recommended
                </div>
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

          {/* Markdown Archive Button */}
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
                <div className="text-xs text-stone-400 mt-0.5">
                  Portable • Human-readable
                </div>
                {isExporting && exportProgress && exportProgress.stage !== 'complete' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>{exportProgress.message}</span>
                      <span>{exportProgress.percent}%</span>
                    </div>
                    <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-600 transition-all duration-300"
                        style={{ width: `${exportProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Last Backup Info */}
        <div className="p-3 rounded-lg bg-stone-800/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400">Last backup:</span>
            <span className={cn(
              'font-medium',
              needsBackup ? 'text-orange-400' : 'text-stone-300'
            )}>
              {lastBackup}
            </span>
          </div>
        </div>

        {/* Import Section (Placeholder for Phase 2) */}
        <div>
          <label className="text-sm font-medium text-sand block mb-2">Import Notes</label>
          <button
            disabled
            className="w-full p-3 rounded-lg border-2 border-stone-700 bg-stone-800/30 text-left opacity-50 cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-stone-700/50 flex items-center justify-center flex-shrink-0">
                <FileArchive className="w-5 h-5 text-stone-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-stone-500">Choose Files...</div>
                <div className="text-xs text-stone-600 mt-0.5">
                  Coming soon
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-3 rounded-lg bg-stone-800/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-stone-500 leading-relaxed">
            All data is stored locally on your device. Backups ensure you never lose your notes.
            For maximum safety, keep backups in multiple locations (cloud storage, external drive).
          </div>
        </div>
      </div>
    </section>
  );
};
