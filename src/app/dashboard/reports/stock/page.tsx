'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Search, RefreshCw, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import DataGrid from '@/components/DataGrid';
import { LoadingSpinner, EmptyState } from '@/components/ui';
import { useSession } from 'next-auth/react';

interface DayCell {
  in: number;
  out: number;
  returnQty: number;
  notes: string[];
}

interface CalendarRow {
  productId: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  startQty: number;
  days: Record<string, DayCell>;
  endingStock: number;
}

interface GridRow {
  name: string;
  color: string;
  size: string;
  productId: string;
  start: number;
  ending: number;
  [dayKey: string]: string | number | Record<string, string[]>;
  __notes: Record<string, string[]>;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

function DayCellRenderer(props: ICellRendererParams) {
  const value = props.value as string;
  if (!value) return <span className="text-ink-200">···</span>;
  const isReturn = value.includes('R');
  const isIn = props.colDef?.cellClass === 'cell-in';
  return (
    <span
      className={
        isIn ? 'text-brand-600 font-semibold' : isReturn ? 'text-amber-600 font-semibold' : 'text-rose-500 font-semibold'
      }
    >
      {value}
    </span>
  );
}

export default function StockCalendarPage() {
  const { data: session } = useSession();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [counterId, setCounterId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!counterId && session?.user?.counterId) {
      setCounterId(session.user.counterId);
    }
  }, [session, counterId]);

  const fetchData = useCallback(async () => {
    if (!counterId) return;
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month), counterId });
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/stock/calendar?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows(json.data ?? []);
      setDaysInMonth(json.daysInMonth ?? 30);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat buku stok');
    } finally {
      setLoading(false);
    }
  }, [year, month, counterId, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function formatCell(day: DayCell): string {
    if (day.in > 0) return String(day.in);
    if (day.out > 0) {
      const saleQty = day.out - day.returnQty;
      if (day.returnQty > 0) {
        return saleQty > 0 ? `${saleQty} - R${day.returnQty}` : `R${day.returnQty}`;
      }
      return String(saleQty);
    }
    return '';
  }

  const gridRows: GridRow[] = useMemo(() => {
    return rows.map((r) => {
      const row: GridRow = {
        name: r.name,
        color: r.color,
        size: r.size,
        productId: r.productId,
        start: r.startQty,
        ending: r.endingStock,
        __notes: {},
      };
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = r.days[String(d)] ?? { in: 0, out: 0, returnQty: 0, notes: [] };
        row[`day_${d}`] = formatCell(cell);
        row.__notes[`day_${d}`] = cell.notes;
      }
      return row;
    });
  }, [rows, daysInMonth]);

  const columnDefs: ColDef[] = useMemo(() => {
    const dayColumns: ColDef[] = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        field: `day_${day}`,
        headerName: String(day),
        width: 46,
        cellRenderer: DayCellRenderer,
        cellClass: (params: { data?: GridRow }) => {
          const cell = params.data?.[`day_${day}`];
          return typeof cell === 'string' && cell && !cell.includes('R') && !cell.includes('-')
            ? 'cell-in'
            : undefined;
        },
        tooltipValueGetter: (params) => {
          const notes: string[] = (params.data?.__notes as Record<string, string[]> | undefined)?.[`day_${day}`] ?? [];
          return notes.length > 0 ? `Surat: ${notes.join(', ')}` : undefined;
        },
        sortable: false,
        cellStyle: { textAlign: 'center', fontSize: '12px' },
      };
    });

    return [
      { field: 'name', headerName: 'NAME', pinned: 'left', width: 160, cellStyle: { fontWeight: 600 } },
      { field: 'color', headerName: 'COLOR', pinned: 'left', width: 100 },
      { field: 'size', headerName: 'SIZE', pinned: 'left', width: 70 },
      { field: 'productId', headerName: 'SKU', pinned: 'left', width: 110, cellStyle: { fontFamily: 'var(--font-jetbrains)', fontSize: '12px' } },
      { field: 'start', headerName: 'START', pinned: 'left', width: 70, cellStyle: { textAlign: 'center' } },
      ...dayColumns,
      {
        field: 'ending',
        headerName: 'ENDING STOCK',
        pinned: 'right',
        width: 120,
        cellStyle: { textAlign: 'center', fontWeight: 700, color: '#1C7C71' },
      },
    ];
  }, [daysInMonth]);

  function handleExport() {
    const params = new URLSearchParams({ year: String(year), month: String(month), counterId });
    if (search) params.set('search', search);
    window.open(`/api/stock/calendar/export?${params}`, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input
            type="text"
            placeholder="Cari nama produk, brand, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-ink-400" />
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="input-base w-auto">
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="input-base w-auto">
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <input
          type="text"
          maxLength={3}
          placeholder="Counter"
          value={counterId}
          onChange={(e) => setCounterId(e.target.value.toUpperCase())}
          className="input-base w-24 font-mono"
        />

        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={handleExport} className="btn-primary ml-auto">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-ink-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Barang Datang (IN)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Penjualan (OUT)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Return (R)</span>
        <span>Arahkan kursor ke sel untuk melihat nomor surat jalan</span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden p-2">
        {!counterId ? (
          <EmptyState title="Pilih Counter" description="Masukkan Counter ID untuk menampilkan buku stok." />
        ) : loading ? (
          <LoadingSpinner />
        ) : gridRows.length === 0 ? (
          <EmptyState title="Tidak ada data" description="Tidak ada produk yang cocok untuk periode dan counter ini." />
        ) : (
          <DataGrid
            rowData={gridRows}
            columnDefs={columnDefs}
            height={Math.min(640, 90 + gridRows.length * 40)}
            tooltipShowDelay={100}
          />
        )}
      </div>
    </div>
  );
}
