'use client';

import { PackageSearch, Loader2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- LoadingSpinner ---------- */
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)}>
      <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
    </div>
  );
}

/* ---------- EmptyState ---------- */
interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
}

export function EmptyState({
  title = 'Tidak ada data',
  description = 'Belum ada data untuk ditampilkan.',
  action,
  icon: Icon = PackageSearch,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-ink-400" />
      </div>
      <p className="font-medium text-ink-700">{title}</p>
      <p className="text-sm text-ink-400 mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- ConfirmModal ---------- */
interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl2 shadow-panel w-full max-w-sm mx-4 p-6">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              variant === 'danger' ? 'bg-rose-100' : 'bg-amber-100'
            )}
          >
            <AlertTriangle
              className={cn(
                'w-5 h-5',
                variant === 'danger' ? 'text-rose-600' : 'text-amber-600'
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-ink-900">{title}</h3>
            <p className="text-sm text-ink-500 mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-secondary">
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Memproses...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
