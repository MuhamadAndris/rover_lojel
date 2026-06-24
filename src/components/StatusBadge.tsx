import { cn } from '@/lib/utils';

type Status =
  | 'success'
  | 'cancel'
  | 'exchange'
  | 'active'
  | 'inactive'
  | 'discontinued'
  | 'pending'
  | 'received'
  | 'sent'
  | 'cancelled'
  | 'upcoming'
  | 'expired';

const STATUS_CONFIG: Record<
  Status,
  { label: string; className: string }
> = {
  success:      { label: 'Sukses',        className: 'bg-brand-100 text-brand-800' },
  cancel:       { label: 'Dibatalkan',    className: 'bg-rose-100 text-rose-600' },
  exchange:     { label: 'Tukar Barang',  className: 'bg-amber-100 text-amber-600' },
  active:       { label: 'Aktif',         className: 'bg-brand-100 text-brand-800' },
  inactive:     { label: 'Tidak Aktif',   className: 'bg-ink-100 text-ink-500' },
  discontinued: { label: 'Discontinue',   className: 'bg-rose-100 text-rose-600' },
  pending:      { label: 'Pending',       className: 'bg-amber-100 text-amber-600' },
  received:     { label: 'Diterima',      className: 'bg-brand-100 text-brand-800' },
  sent:         { label: 'Dikirim',       className: 'bg-brand-100 text-brand-800' },
  cancelled:    { label: 'Dibatalkan',    className: 'bg-rose-100 text-rose-600' },
  upcoming:     { label: 'Akan Datang',   className: 'bg-amber-100 text-amber-600' },
  expired:      { label: 'Kadaluarsa',    className: 'bg-ink-100 text-ink-500' },
};

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as Status] ?? {
    label: status,
    className: 'bg-ink-100 text-ink-500',
  };

  return (
    <span className={cn('badge', config.className, className)}>
      {config.label}
    </span>
  );
}
