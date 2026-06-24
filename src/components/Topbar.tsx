'use client';

import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { ROLE_LABELS } from '@/lib/rbac';
import type { UserRole } from '@/models';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/transactions': 'Transaksi',
  '/dashboard/transactions/new': 'Buat Transaksi',
  '/dashboard/incoming': 'Datang Barang',
  '/dashboard/returns': 'Return Barang',
  '/dashboard/products': 'Manajemen Produk',
  '/dashboard/promos': 'Manajemen Promo',
  '/dashboard/users': 'Manajemen Pengguna',
  '/dashboard/reports/sales': 'Laporan Penjualan',
  '/dashboard/reports/stock': 'Buku Stok',
  '/dashboard/reports/revenue': 'Analisa Omset',
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match dynamic segments like /dashboard/transactions/TRX-xxx/edit
  const segments = pathname.split('/');
  if (segments.includes('edit')) return 'Edit Transaksi';
  if (segments.includes('transactions') && segments.length > 3) return 'Detail Transaksi';
  return 'Retail POS';
}

export default function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const title = getTitle(pathname);
  const role = session?.user?.role as UserRole | undefined;

  return (
    <header className="h-16 bg-white border-b border-ink-100 flex items-center justify-between px-6 sticky top-0 z-20">
      <h1 className="font-display text-lg font-semibold text-ink-900 tracking-tight">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-50 hover:text-ink-700 transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>
        <div className="h-5 w-px bg-ink-100" />
        <div className="text-right">
          <p className="text-sm font-medium text-ink-800 leading-none">
            {session?.user?.name || '—'}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">
            {role ? ROLE_LABELS[role] : '—'}
            {session?.user?.counterId ? ` · Counter ${session.user.counterId}` : ''}
          </p>
        </div>
      </div>
    </header>
  );
}
