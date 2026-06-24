'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Plus, Upload, Download, Search, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { LoadingSpinner, EmptyState, ConfirmModal } from '@/components/ui';
import ImportModal from './ImportModal';
import { hasPermission } from '@/lib/rbac';
import type { UserRole } from '@/models';

interface TransactionListItem {
  _id: string;
  transactionId: string;
  date: string;
  counterId: string;
  bonNumber: string;
  saleByUserId: string;
  spvId: string;
  status: string;
  totalQty: number;
  totalFinalAmount: number;
  totalPromoValue: number;
  items: { productId: string; productDescription: string; qty: number }[];
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'success', label: 'Sukses' },
  { value: 'cancel', label: 'Dibatalkan' },
  { value: 'exchange', label: 'Tukar Barang' },
];

export default function TransactionsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const [data, setData] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    newStatus: string;
  } | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    try {
      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch {
      toast.error('Gagal memuat data transaksi');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, dateFrom, dateTo]);

  async function handleStatusChange() {
    if (!statusChangeTarget) return;
    setStatusChanging(true);
    try {
      const res = await fetch(
        `/api/transactions/${statusChangeTarget.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: statusChangeTarget.newStatus }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success('Status berhasil diubah');
      setStatusChangeTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status');
    } finally {
      setStatusChanging(false);
    }
  }

  const canCreate = role && hasPermission(role, 'transaction:create');
  const canImport = role && hasPermission(role, 'transaction:import');
  const canEdit = role && hasPermission(role, 'transaction:edit');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            type="text"
            placeholder="Cari ID transaksi, bon, produk…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base w-auto"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-base w-auto"
          title="Dari tanggal"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-base w-auto"
          title="Sampai tanggal"
        />

        <button onClick={fetchData} className="btn-secondary" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {canImport && (
            <>
              <a href="/api/transactions/template" download className="btn-secondary text-xs">
                <Download className="w-3.5 h-3.5" /> Template CSV
              </a>
              <button onClick={() => setImportOpen(true)} className="btn-secondary text-xs">
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
            </>
          )}
          {canCreate && (
            <Link href="/dashboard/transactions/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Buat Transaksi
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">ID Transaksi</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500">Counter</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500">Bon</th>
                <th className="text-left px-4 py-3 font-medium text-ink-500">SA</th>
                <th className="text-right px-4 py-3 font-medium text-ink-500">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-ink-500">Diskon</th>
                <th className="text-right px-4 py-3 font-medium text-ink-500">Total</th>
                <th className="text-center px-4 py-3 font-medium text-ink-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="Belum ada transaksi"
                      description="Buat transaksi baru atau import dari file CSV/Excel."
                      action={
                        canCreate ? (
                          <Link href="/dashboard/transactions/new" className="btn-primary text-sm">
                            <Plus className="w-4 h-4" /> Buat Transaksi
                          </Link>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                data.map((txn) => (
                  <tr key={txn._id} className="hover:bg-ink-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/transactions/${txn.transactionId}`}
                        className="font-mono text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        {txn.transactionId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-600 whitespace-nowrap text-xs">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded">
                        {txn.counterId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600 text-xs">{txn.bonNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-600">{txn.saleByUserId}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{txn.totalQty}</td>
                    <td className="px-4 py-3 text-right text-rose-500 text-xs">
                      {txn.totalPromoValue > 0 ? `−${formatCurrency(txn.totalPromoValue)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900 whitespace-nowrap">
                      {formatCurrency(txn.totalFinalAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={txn.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/dashboard/transactions/${txn.transactionId}`}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Detail
                        </Link>
                        {canEdit && txn.status === 'success' && (
                          <>
                            <span className="text-ink-200">·</span>
                            <button
                              onClick={() =>
                                setStatusChangeTarget({
                                  id: txn.transactionId,
                                  newStatus: 'cancel',
                                })
                              }
                              className="text-xs text-rose-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {canEdit && txn.status === 'success' && (
                          <>
                            <span className="text-ink-200">·</span>
                            <button
                              onClick={() =>
                                setStatusChangeTarget({
                                  id: txn.transactionId,
                                  newStatus: 'exchange',
                                })
                              }
                              className="text-xs text-amber-600 hover:underline"
                            >
                              Tukar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && data.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Status change confirm */}
      <ConfirmModal
        open={!!statusChangeTarget}
        title={
          statusChangeTarget?.newStatus === 'cancel'
            ? 'Batalkan Transaksi?'
            : 'Tandai Tukar Barang?'
        }
        description={
          statusChangeTarget?.newStatus === 'cancel'
            ? 'Stok produk akan dikembalikan secara otomatis. Tindakan ini tidak dapat di-undo tanpa mengubah status ulang.'
            : 'Transaksi akan ditandai sebagai tukar barang. Stok akan dikembalikan.'
        }
        confirmLabel={statusChangeTarget?.newStatus === 'cancel' ? 'Ya, Batalkan' : 'Ya, Tukar'}
        variant={statusChangeTarget?.newStatus === 'cancel' ? 'danger' : 'default'}
        loading={statusChanging}
        onConfirm={handleStatusChange}
        onCancel={() => setStatusChangeTarget(null)}
      />

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
