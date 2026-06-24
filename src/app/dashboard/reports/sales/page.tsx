'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, TrendingUp, Receipt, Package, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ColDef } from 'ag-grid-community';
import DataGrid from '@/components/DataGrid';
import { LoadingSpinner, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

interface SalesRow {
  transactionId: string;
  date: string;
  counterId: string;
  bonNumber: string;
  saleByUserId: string;
  spvId: string;
  status: string;
  productId: string;
  productDescription: string;
  qty: number;
  normalPrice: number;
  promoDescription: string | null;
  promoValue: number;
  finalPrice: number;
}

interface Summary {
  totalTransaksi: number;
  totalItem: number;
  totalOmset: number;
  totalDiskon: number;
  totalNormal: number;
}

type GroupMode = 'none' | 'product' | 'sa' | 'counter';

const STATUS_OPTIONS = [
  { value: 'success', label: 'Sukses Saja' },
  { value: 'all', label: 'Semua Status' },
  { value: 'cancel', label: 'Dibatalkan' },
  { value: 'exchange', label: 'Tukar Barang' },
];

export default function SalesReportPage() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [grouped, setGrouped] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupBy, setGroupBy] = useState<GroupMode>('none');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [counterId, setCounterId] = useState('');
  const [status, setStatus] = useState('success');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ groupBy, status });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (counterId) params.set('counterId', counterId);
    try {
      const res = await fetch(`/api/reports/sales?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.rows ?? []);
      setSummary(json.summary ?? null);
      setGrouped(json.grouped ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }, [groupBy, dateFrom, dateTo, counterId, status]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const detailColumns: ColDef[] = useMemo(() => [
    { field: 'transactionId', headerName: 'ID Transaksi', width: 160, cellClass: 'font-mono' },
    { field: 'date', headerName: 'Tanggal', width: 110, valueFormatter: (p) => formatDate(p.value) },
    { field: 'counterId', headerName: 'Counter', width: 90 },
    { field: 'bonNumber', headerName: 'Bon', width: 110 },
    { field: 'productId', headerName: 'Product ID', width: 120, cellClass: 'font-mono' },
    { field: 'productDescription', headerName: 'Deskripsi', width: 240 },
    { field: 'qty', headerName: 'Qty', width: 70, cellStyle: { textAlign: 'right' } },
    { field: 'normalPrice', headerName: 'Harga Normal', width: 130, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right' } },
    { field: 'promoDescription', headerName: 'Promo', width: 110 },
    { field: 'promoValue', headerName: 'Diskon', width: 110, valueFormatter: (p) => (p.value > 0 ? `-${formatCurrency(p.value)}` : '-'), cellStyle: { textAlign: 'right' } },
    { field: 'finalPrice', headerName: 'Harga Akhir', width: 140, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right', fontWeight: 600 } },
    { field: 'saleByUserId', headerName: 'SA', width: 100, cellClass: 'font-mono' },
    { field: 'spvId', headerName: 'SPV', width: 100, cellClass: 'font-mono' },
    { field: 'status', headerName: 'Status', width: 110 },
  ], []);

  const groupedColumns: ColDef[] = useMemo(() => {
    if (groupBy === 'product') {
      return [
        { field: 'productId', headerName: 'Product ID', width: 130, cellClass: 'font-mono' },
        { field: 'productDescription', headerName: 'Deskripsi', flex: 1, minWidth: 240 },
        { field: 'qty', headerName: 'Qty Terjual', width: 120, cellStyle: { textAlign: 'right' } },
        { field: 'diskon', headerName: 'Total Diskon', width: 140, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right' } },
        { field: 'omset', headerName: 'Omset', width: 150, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right', fontWeight: 700, color: '#1C7C71' } },
      ];
    }
    if (groupBy === 'sa') {
      return [
        { field: 'saId', headerName: 'SA ID', width: 130, cellClass: 'font-mono' },
        { field: 'transaksi', headerName: 'Jml Transaksi', width: 140, cellStyle: { textAlign: 'right' } },
        { field: 'qty', headerName: 'Qty Terjual', width: 130, cellStyle: { textAlign: 'right' } },
        { field: 'omset', headerName: 'Omset', width: 160, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right', fontWeight: 700, color: '#1C7C71' } },
      ];
    }
    if (groupBy === 'counter') {
      return [
        { field: 'counterId', headerName: 'Counter', width: 130 },
        { field: 'transaksi', headerName: 'Jml Transaksi', width: 140, cellStyle: { textAlign: 'right' } },
        { field: 'qty', headerName: 'Qty Terjual', width: 130, cellStyle: { textAlign: 'right' } },
        { field: 'omset', headerName: 'Omset', width: 160, valueFormatter: (p) => formatCurrency(p.value), cellStyle: { textAlign: 'right', fontWeight: 700, color: '#1C7C71' } },
      ];
    }
    return [];
  }, [groupBy]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupMode)} className="input-base w-auto">
          <option value="none">Histori Detail (per item)</option>
          <option value="product">Rekap per Produk</option>
          <option value="sa">Rekap per SA</option>
          <option value="counter">Rekap per Counter</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base w-auto">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-base w-auto" title="Dari tanggal" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-base w-auto" title="Sampai tanggal" />
        <input type="text" maxLength={3} placeholder="Counter" value={counterId} onChange={(e) => setCounterId(e.target.value.toUpperCase())} className="input-base w-24 font-mono" />
        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center mb-3"><TrendingUp className="w-4.5 h-4.5 text-brand-600" /></div>
            <p className="text-xl font-display font-semibold text-ink-900">{formatCurrency(summary.totalOmset)}</p>
            <p className="text-sm text-ink-400 mt-0.5">Total Omset</p>
          </div>
          <div className="stat-card">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3"><Receipt className="w-4.5 h-4.5 text-amber-600" /></div>
            <p className="text-xl font-display font-semibold text-ink-900">{summary.totalTransaksi}</p>
            <p className="text-sm text-ink-400 mt-0.5">Jumlah Transaksi</p>
          </div>
          <div className="stat-card">
            <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center mb-3"><Package className="w-4.5 h-4.5 text-ink-500" /></div>
            <p className="text-xl font-display font-semibold text-ink-900">{summary.totalItem}</p>
            <p className="text-sm text-ink-400 mt-0.5">Item Terjual</p>
          </div>
          <div className="stat-card">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center mb-3"><Percent className="w-4.5 h-4.5 text-rose-500" /></div>
            <p className="text-xl font-display font-semibold text-rose-500">{formatCurrency(summary.totalDiskon)}</p>
            <p className="text-sm text-ink-400 mt-0.5">Total Diskon</p>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden p-2">
        {loading ? (
          <LoadingSpinner />
        ) : groupBy === 'none' ? (
          rows.length === 0 ? (
            <EmptyState title="Belum ada data penjualan" description="Coba ubah filter tanggal atau status." />
          ) : (
            <DataGrid rowData={rows} columnDefs={detailColumns} height={560} />
          )
        ) : grouped.length === 0 ? (
          <EmptyState title="Belum ada data" description="Coba ubah filter tanggal atau status." />
        ) : (
          <DataGrid rowData={grouped} columnDefs={groupedColumns} height={560} />
        )}
      </div>
    </div>
  );
}
