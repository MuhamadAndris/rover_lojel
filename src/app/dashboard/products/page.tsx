'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Search, RefreshCw, Pencil, Ban, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { LoadingSpinner, EmptyState, ConfirmModal } from '@/components/ui';
import GenericImportModal from '@/components/GenericImportModal';
import { hasPermission } from '@/lib/rbac';
import type { UserRole } from '@/models';

interface Product {
  _id: string;
  productId: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  status: string;
  createdBy: string;
  updatedAt: string;
}

const EMPTY_FORM = { productId: '', brand: '', name: '', color: '', size: '', status: 'active' as const };

export default function ProductsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const canManage = role && hasPermission(role, 'product:manage');

  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) params.set('q', q);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch { toast.error('Gagal memuat data produk'); }
    finally { setLoading(false); }
  }, [page, q, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [q, statusFilter]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ productId: p.productId, brand: p.brand, name: p.name, color: p.color, size: p.size, status: p.status as 'active' | 'inactive' });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/products/${editing.productId}` : '/api/products';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editing ? 'Produk diperbarui' : 'Produk berhasil ditambahkan');
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
      const res = await fetch(`/api/products/${deleteTarget.productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Produk dinonaktifkan');
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally { setDeleting(false); }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Cari ID, brand, nama…" value={q} onChange={(e) => setQ(e.target.value)} className="input-base pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
          <option value="discontinued">Discontinue</option>
        </select>
        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        {canManage && (
          <button onClick={() => setImportOpen(true)} className="btn-secondary text-xs"><Upload className="w-3.5 h-3.5" /> Import</button>
        )}
        {canManage && (
          <button onClick={openNew} className="btn-primary ml-auto"><Plus className="w-4 h-4" /> Tambah Produk</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                {['Product ID', 'Brand', 'Nama', 'Warna', 'Ukuran', 'Status', 'Diperbarui', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? <tr><td colSpan={8}><LoadingSpinner /></td></tr>
              : data.length === 0 ? <tr><td colSpan={8}><EmptyState title="Belum ada produk" description="Tambahkan produk baru untuk mulai." action={canManage ? <button onClick={openNew} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Tambah Produk</button> : undefined} /></td></tr>
              : data.map((p) => (
                <tr key={p._id} className="hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700 font-medium">{p.productId}</td>
                  <td className="px-4 py-3 font-medium text-ink-800">{p.brand}</td>
                  <td className="px-4 py-3 text-ink-600">{p.name}</td>
                  <td className="px-4 py-3 text-ink-500">{p.color}</td>
                  <td className="px-4 py-3 text-ink-500">{p.size}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-ink-400 text-xs">{formatDate(p.updatedAt)}</td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                        {p.status !== 'discontinued' && (
                          <button onClick={() => setDeleteTarget(p)} className="text-xs text-rose-500 hover:underline flex items-center gap-1"><Ban className="w-3 h-3" />Nonaktifkan</button>
                        )}
                      </div>
                    )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <form onSubmit={handleSave} className="relative bg-white rounded-xl2 shadow-panel w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="font-display font-semibold text-ink-900">
              {editing ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h2>
            {[
              { label: 'Product ID (9 digit)', key: 'productId', placeholder: '901222050', mono: true, disabled: !!editing },
              { label: 'Brand', key: 'brand', placeholder: 'NIKE' },
              { label: 'Nama Produk', key: 'name', placeholder: 'AIR MAX 270' },
              { label: 'Warna', key: 'color', placeholder: 'BLACK' },
              { label: 'Ukuran', key: 'size', placeholder: '42' },
            ].map(({ label, key, placeholder, mono, disabled }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-ink-600 mb-1">{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  disabled={disabled}
                  className={`input-base ${mono ? 'font-mono' : ''} disabled:bg-ink-50`}
                  required
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))} className="input-base">
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Nonaktifkan Produk?"
        description={`Produk ${deleteTarget?.productId} (${deleteTarget?.brand} ${deleteTarget?.name}) akan ditandai sebagai discontinued.`}
        confirmLabel="Ya, Nonaktifkan"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <GenericImportModal
        open={importOpen}
        title="Import Produk"
        importUrl="/api/products/import"
        templateUrl="/api/products/template"
        templateFileLabel="Download template CSV produk"
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); fetchData(); }}
        resultStats={[
          { key: 'totalRows', label: 'Total Baris' },
          { key: 'created', label: 'Produk Baru', tone: 'brand' },
          { key: 'updated', label: 'Produk Diperbarui' },
        ]}
      />
    </div>
  );
}
