'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Receipt,
  PackageSearch,
  PackagePlus,
  PackageMinus,
  Box,
  Tag,
  Users,
  BarChart2,
  TrendingUp,
  Store,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/rbac';
import type { UserRole } from '@/models';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Parameters<typeof hasPermission>[1];
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { label: 'Transaksi', href: '/dashboard/transactions', icon: Receipt, permission: 'transaction:create' },
      { label: 'Datang Barang', href: '/dashboard/incoming', icon: PackagePlus, permission: 'stock:manage' },
      { label: 'Return Barang', href: '/dashboard/returns', icon: PackageMinus, permission: 'stock:manage' },
    ],
  },
  {
    title: 'Master Data',
    items: [
      { label: 'Produk', href: '/dashboard/products', icon: Box, permission: 'product:view' },
      { label: 'Promo', href: '/dashboard/promos', icon: Tag, permission: 'promo:view' },
      { label: 'Pengguna', href: '/dashboard/users', icon: Users, permission: 'user:manage' },
    ],
  },
  {
    title: 'Laporan',
    items: [
      { label: 'Penjualan', href: '/dashboard/reports/sales', icon: TrendingUp, permission: 'report:view' },
      { label: 'Buku Stok', href: '/dashboard/reports/stock', icon: PackageSearch, permission: 'stock:view' },
      { label: 'Analisa Omset', href: '/dashboard/reports/revenue', icon: BarChart2, permission: 'report:view' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-60 bg-ink-950 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-semibold text-white text-base tracking-tight">
          Retail POS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.permission || !role || hasPermission(role, item.permission)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title}>
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-500">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors group',
                          active
                            ? 'bg-brand-600/20 text-brand-300'
                            : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.04]'
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0',
                            active ? 'text-brand-400' : 'text-ink-500 group-hover:text-ink-300'
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {active && (
                          <ChevronRight className="w-3 h-3 text-brand-400" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-100">
              {session?.user?.name?.slice(0, 2).toUpperCase() || '--'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-100 font-medium truncate">
              {session?.user?.name || '—'}
            </p>
            <p className="text-[11px] text-ink-500 font-mono">
              {session?.user?.userId}
              {session?.user?.counterId ? ` · ${session.user.counterId}` : ''}
            </p>
          </div>
        </div>
        <Link
          href="/api/auth/signout"
          className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-ink-500 hover:text-rose-400 hover:bg-white/[0.04] transition-colors"
        >
          Keluar
        </Link>
      </div>
    </aside>
  );
}
