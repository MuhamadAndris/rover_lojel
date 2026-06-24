'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Search, RefreshCw, Pencil, Trash2, History, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { LoadingSpinner, EmptyState, ConfirmModal } from '@/components/ui';
import GenericImportModal from '@/components/GenericImportModal';
import { hasPermission } from '@/lib/rbac';
import type { UserRole } from '@/models';

interface PromoHistoryEntry {
  action: string;
  changedBy: string;
  changedAt: string;
  snapshot: Record<string, unknown>;
}

interface Promo {
  _id: string;
  promoId: string;
  startDate: string;
  endDate: string | null;
  productId: string;
  productDescription: string;
  promoDescription: string;
  promoValue: number;
  normalPrice: number;
  finalPrice: number;
  createdBy: string;
  updatedBy: string;
  derivedStatus: 'upcoming' | 'active' | 'expired';
  history: PromoHistoryEntry[];
}

const EMPTY_FORM = {
  promoId: '',
  productId: '',
  productDescription: '',
  promoDescription: '',
  promoValue: 0,
  normalPrice: 0,
  finalPrice: 0,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
};

export default function PromosPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const canManage = role && hasPermission(role, 'promo:manage');

  const [data, setData] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Promo | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) params.set('q', q);
    if (activeFilter) params.set('active', activeFilter);
    try {
      const res = await fetch(`/api/promos?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch { toast.error('Gagal memuat data promo'); }
    finally { setLoading(false); }
  }, [page, q, activeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [q, activeFilter]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: Promo) {
    setEditing(p);
    setForm({
      promoId: p.promoId,
      productId: p.productId,
      productDescription: p.productDescription,
      promoDescription: p.promoDescription,
      promoValue: p.promoValue,
      normalPrice: p.normalPrice,
      finalPrice: p.finalPrice,
      startDate: p.startDate.slice(0, 10),
      endDate: p.endDate ? p.endDate.slice(0, 10) : '',
    });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/promos/${editing.promoId}` : '/api/promos';
      const method = editing ? 'PUT' : 'POST';
      const payload = { ...form, endDate: form.endDate || null };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editing ? 'Promo diperbarui' : 'Promo berhasil dibuat');
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/promos/${deleteTarget.promoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Promo dihapus');
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally { setDeleting(false); }
  }

  // Auto-calc final price when normalPrice/promoValue change
  function updateNumeric(key: 'normalPrice' | 'promoValue', value: number) {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      updated.finalPrice = Math.max(0, updated.normalPrice - updated.promoValue);
      return updated;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Cari ID promo, produk…" value={q} onChange={(e) => setQ(e.target.value)} className="input-base pl-9" />
        </div>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="input-base w-auto">
          <option value="">Semua Periode</option>
          <option value="true">Sedang Aktif</option>
          <option value="false">Tidak Aktif</option>
        </select>
        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        {canManage && (
          <button onClick={() => setImportOpen(true)} className="btn-secondary text-xs"><Upload className="w-3.5 h-3.5" /> Import</button>
        )}
        {canManage && (
          <button onClick={openNew} className="btn-primary ml-auto"><Plus className="w-4 h-4" /> Buat Promo</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                {['Promo ID', 'Produk', 'Promo', 'Harga Normal', 'Harga Akhir', 'Periode', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? <tr><td colSpan={8}><LoadingSpinner /></td></tr>
              : data.length === 0 ? <tr><td colSpan={8}><EmptyState title="Belum ada promo" description="Buat promo baru untuk produk tertentu." action={canManage ? <button onClick={openNew} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Buat Promo</button> : undefined} /></td></tr>
              : data.map((p) => (
                <tr key={p._id} className="hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700">{p.promoId}</td>
                  <td className="px-4 py-3">
                    <p className="text-ink-800 font-medium text-xs">{p.productId}</p>
                    <p className="text-ink-400 text-xs">{p.productDescription}</p>
                  </td>
                  <td className="px-4 py-3"><span className="badge bg-amber-100 text-amber-600">{p.promoDescription}</span></td>
                  <td className="px-4 py-3 text-ink-500 line-through text-xs">{formatCurrency(p.normalPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-brand-700">{formatCurrency(p.finalPrice)}</td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'Tanpa batas'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={p.derivedStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setHistoryTarget(p)} className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1" title="Riwayat perubahan">
                        <History className="w-3 h-3" />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(p)} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                          <button onClick={() => setDeleteTarget(p)} className="text-xs text-rose-500 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.length > 0 && (
          <div className="px-4 pb-4"><Pagination page={page} totalPages={totalPages} total={total} limit={20} onPageChange={setPage} /></div>
        )}
      </div>

      {/* Form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <form onSubmit={handleSave} className="relative bg-white rounded-xl2 shadow-panel w-full max-w-md mx-4 p-6 space-y-4 my-auto">
            <h2 className="font-display font-semibold text-ink-900">{editing ? 'Edit Promo' : 'Buat Promo Baru'}</h2>

            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Promo ID</label>
              <input type="text" disabled={!!editing} value={form.promoId} onChange={(e) => setForm((f) => ({ ...f, promoId: e.target.value }))} className="input-base font-mono disabled:bg-ink-50" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Product ID (9 digit)</label>
              <input type="text" disabled={!!editing} value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} className="input-base font-mono disabled:bg-ink-50" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Deskripsi Produk</label>
              <input type="text" value={form.productDescription} onChange={(e) => setForm((f) => ({ ...f, productDescription: e.target.value }))} className="input-base" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Deskripsi Promo</label>
              <input type="text" placeholder="10%, 20+10%, BUY 1 GET 1…" value={form.promoDescription} onChange={(e) => setForm((f) => ({ ...f, promoDescription: e.target.value }))} className="input-base" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Harga Normal</label>
                <input type="number" min={0} value={form.normalPrice} onChange={(e) => updateNumeric('normalPrice', parseFloat(e.target.value) || 0)} className="input-base" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Nilai Promo</label>
                <input type="number" min={0} value={form.promoValue} onChange={(e) => updateNumeric('promoValue', parseFloat(e.target.value) || 0)} className="input-base" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Harga Akhir</label>
              <input type="number" min={0} value={form.finalPrice} onChange={(e) => setForm((f) => ({ ...f, finalPrice: parseFloat(e.target.value) || 0 }))} className="input-base font-semibold text-brand-700" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Mulai</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="input-base" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Berakhir (opsional)</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="input-base" />
                <p className="text-[11px] text-ink-400 mt-1">Kosongkan jika belum ada batas waktu</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      {/* History modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setHistoryTarget(null)} />
          <div className="relative bg-white rounded-xl2 shadow-panel w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-ink-900">Riwayat Promo {historyTarget.promoId}</h2>
              <button onClick={() => setHistoryTarget(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100"><X className="w-4 h-4" /></button>
            </div>
            {historyTarget.history.length === 0 ? (
              <p className="text-sm text-ink-400">Belum ada riwayat perubahan.</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
                {historyTarget.history.slice().reverse().map((h, i) => (
                  <li key={i} className="border-l-2 border-brand-300 pl-3">
                    <p className="text-sm font-medium text-ink-800 capitalize">
                      {h.action === 'created' ? 'Dibuat' : h.action === 'updated' ? 'Diperbarui' : 'Dihapus'}
                    </p>
                    <p className="text-xs text-ink-400">
                      oleh {h.changedBy} · {formatDate(h.changedAt, true)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Promo?"
        description={`Promo ${deleteTarget?.promoId} akan dihapus (soft-delete, riwayat tetap tersimpan).`}
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <GenericImportModal
        open={importOpen}
        title="Import Promo"
        importUrl="/api/promos/import"
        templateUrl="/api/promos/template"
        templateFileLabel="Download template CSV promo"
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); fetchData(); }}
        resultStats={[
          { key: 'totalRows', label: 'Total Baris' },
          { key: 'created', label: 'Promo Baru', tone: 'brand' },
          { key: 'updated', label: 'Promo Diperbarui' },
        ]}
      />
    </div>
  );
}
