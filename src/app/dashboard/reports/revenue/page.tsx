'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui';
import RevenueChart from './RevenueChart';

interface MonthlyData {
  month: number;
  omset: number;
  transaksi: number;
  item: number;
  diskon: number;
  target?: number;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function RevenueAnalysisPage() {
  const [yearA, setYearA] = useState(CURRENT_YEAR);
  const [yearB, setYearB] = useState<number | ''>('');
  const [counterId, setCounterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [monthlyA, setMonthlyA] = useState<MonthlyData[]>([]);
  const [monthlyB, setMonthlyB] = useState<MonthlyData[]>([]);
  const [totalA, setTotalA] = useState(0);
  const [totalB, setTotalB] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ yearA: String(yearA) });
    if (yearB) params.set('yearB', String(yearB));
    if (counterId) params.set('counterId', counterId);
    try {
      const res = await fetch(`/api/reports/revenue?${params}`);
      const json = await res.json();
      setMonthlyA(json.monthlyA ?? []);
      setMonthlyB(json.monthlyB ?? []);
      setTotalA(json.totalA ?? 0);
      setTotalB(json.totalB ?? 0);
    } catch { toast.error('Gagal memuat analisa omset'); }
    finally { setLoading(false); }
  }, [yearA, yearB, counterId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const growth = totalB > 0 ? (((totalA - totalB) / totalB) * 100).toFixed(1) : null;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-ink-400" />
          <select value={yearA} onChange={(e) => setYearA(parseInt(e.target.value))} className="input-base w-auto">
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-ink-400 text-sm">vs</span>
          <select value={yearB} onChange={(e) => setYearB(e.target.value ? parseInt(e.target.value) : '')} className="input-base w-auto">
            <option value="">Tidak ada pembanding</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <input
          type="text"
          maxLength={3}
          placeholder="Filter Counter (opsional)"
          value={counterId}
          onChange={(e) => setCounterId(e.target.value.toUpperCase())}
          className="input-base w-48 font-mono"
        />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center mb-3">
                <TrendingUp className="w-4.5 h-4.5 text-brand-600" />
              </div>
              <p className="text-2xl font-display font-semibold text-ink-900">{formatCurrency(totalA)}</p>
              <p className="text-sm text-ink-400 mt-0.5">Total Omset {yearA}</p>
            </div>
            {yearB && (
              <div className="stat-card">
                <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center mb-3">
                  <TrendingUp className="w-4.5 h-4.5 text-ink-500" />
                </div>
                <p className="text-2xl font-display font-semibold text-ink-900">{formatCurrency(totalB)}</p>
                <p className="text-sm text-ink-400 mt-0.5">Total Omset {yearB}</p>
              </div>
            )}
            {growth && (
              <div className="stat-card">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${parseFloat(growth) >= 0 ? 'bg-brand-100' : 'bg-rose-100'}`}>
                  <TrendingUp className={`w-4.5 h-4.5 ${parseFloat(growth) >= 0 ? 'text-brand-600' : 'text-rose-500'}`} />
                </div>
                <p className={`text-2xl font-display font-semibold ${parseFloat(growth) >= 0 ? 'text-brand-600' : 'text-rose-500'}`}>
                  {parseFloat(growth) >= 0 ? '+' : ''}{growth}%
                </p>
                <p className="text-sm text-ink-400 mt-0.5">Pertumbuhan vs {yearB}</p>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl2 border border-ink-100 shadow-card p-5">
            <h2 className="font-semibold text-ink-800 mb-4 text-sm">Perbandingan Omset Bulanan</h2>
            <RevenueChart monthlyA={monthlyA} monthlyB={monthlyB} yearA={yearA} yearB={yearB || null} />
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50">
                    <th className="text-left px-4 py-3 font-medium text-ink-500">Bulan</th>
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Omset {yearA}</th>
                    {yearB && <th className="text-right px-4 py-3 font-medium text-ink-500">Omset {yearB}</th>}
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Transaksi</th>
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Item Terjual</th>
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Diskon</th>
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Target</th>
                    <th className="text-right px-4 py-3 font-medium text-ink-500">Achv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {monthlyA.map((m, i) => {
                    const achv = m.target ? Math.round((m.omset / m.target) * 100) : null;
                    return (
                      <tr key={m.month} className="hover:bg-ink-50/50">
                        <td className="px-4 py-3 font-medium text-ink-700">{MONTH_NAMES[i]}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink-900">{formatCurrency(m.omset)}</td>
                        {yearB && (
                          <td className="px-4 py-3 text-right text-ink-500">{formatCurrency(monthlyB[i]?.omset ?? 0)}</td>
                        )}
                        <td className="px-4 py-3 text-right text-ink-600">{m.transaksi}</td>
                        <td className="px-4 py-3 text-right text-ink-600">{m.item}</td>
                        <td className="px-4 py-3 text-right text-rose-500">{m.diskon > 0 ? `−${formatCurrency(m.diskon)}` : '—'}</td>
                        <td className="px-4 py-3 text-right text-ink-400">{m.target ? formatCurrency(m.target) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {achv !== null ? (
                            <span className={`font-semibold text-xs ${achv >= 100 ? 'text-brand-600' : achv >= 75 ? 'text-amber-600' : 'text-rose-500'}`}>
                              {achv}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
