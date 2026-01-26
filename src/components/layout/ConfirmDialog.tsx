import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'text-red-400',
    warning: 'text-orange-400',
    info: 'text-blue-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card max-w-md w-full shadow-2xl border-stone-700 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-stone-800', variantStyles[variant])}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-sand">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-stone-800 rounded transition-all"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Message */}
        <p className="text-stone-300 mb-6 leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-ghost flex-1"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={cn(
              'flex-1 px-4 py-3 rounded-lg font-medium transition-all min-h-[44px]',
              variant === 'danger' && 'bg-red-500 hover:bg-red-600 text-white',
              variant === 'warning' && 'bg-orange-500 hover:bg-orange-600 text-white',
              variant === 'info' && 'bg-blue-500 hover:bg-blue-600 text-white'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
