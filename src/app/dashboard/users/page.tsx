'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Pencil, Ban, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { LoadingSpinner, EmptyState, ConfirmModal } from '@/components/ui';
import GenericImportModal from '@/components/GenericImportModal';
import { ROLE_LABELS } from '@/lib/rbac';
import type { UserRole } from '@/models';

interface UserRow {
  _id: string;
  userId: string;
  name: string;
  role: UserRole;
  counterId?: string;
  status: string;
  createdAt: string;
}

const EMPTY_FORM = { userId: '', name: '', role: 'sa' as UserRole, password: '', counterId: '', status: 'active' as const };

export default function UsersPage() {
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) params.set('q', q);
    try {
      const res = await fetch(`/api/users?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat data'); }
    finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [q]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }
  function openEdit(u: UserRow) {
    setEditing(u);
    setForm({ userId: u.userId, name: u.name, role: u.role, password: '', counterId: u.counterId || '', status: u.status as 'active' | 'inactive' });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/users/${editing.userId}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const payload: Record<string, unknown> = { ...form };
      if (editing && !form.password) delete payload.password;
      if (!form.counterId) delete payload.counterId;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(editing ? 'Pengguna diperbarui' : 'Pengguna berhasil ditambahkan');
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${deactivateTarget.userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Pengguna dinonaktifkan');
      setDeactivateTarget(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal');
    } finally { setDeactivating(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Cari User ID, nama…" value={q} onChange={(e) => setQ(e.target.value)} className="input-base pl-9" />
        </div>
        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setImportOpen(true)} className="btn-secondary text-xs"><Upload className="w-3.5 h-3.5" /> Import</button>
        <button onClick={openNew} className="btn-primary ml-auto"><Plus className="w-4 h-4" /> Tambah Pengguna</button>
      </div>

      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                {['User ID', 'Nama', 'Role', 'Counter', 'Status', 'Dibuat', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? <tr><td colSpan={7}><LoadingSpinner /></td></tr>
              : data.length === 0 ? <tr><td colSpan={7}><EmptyState title="Belum ada pengguna" description="Tambahkan pengguna baru." action={<button onClick={openNew} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Tambah Pengguna</button>} /></td></tr>
              : data.map((u) => (
                <tr key={u._id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700 font-medium">{u.userId}</td>
                  <td className="px-4 py-3 font-medium text-ink-800">{u.name}</td>
                  <td className="px-4 py-3 text-ink-600">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3">{u.counterId ? <span className="font-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded">{u.counterId}</span> : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-ink-400 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                      {u.status === 'active' && (
                        <button onClick={() => setDeactivateTarget(u)} className="text-xs text-rose-500 hover:underline flex items-center gap-1"><Ban className="w-3 h-3" />Nonaktifkan</button>
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

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <form onSubmit={handleSave} className="relative bg-white rounded-xl2 shadow-panel w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="font-display font-semibold text-ink-900">{editing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</h2>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">User ID (7 digit)</label>
              <input type="text" maxLength={7} disabled={!!editing} value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value.replace(/\D/g, '') }))} className="input-base font-mono disabled:bg-ink-50" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Nama Lengkap</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-base" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))} className="input-base">
                <option value="sa">Sales Associate</option>
                <option value="spv">Supervisor</option>
                <option value="admin_post">Admin / Post</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Counter ID (opsional, 3 karakter)</label>
              <input type="text" maxLength={3} value={form.counterId} onChange={(e) => setForm((f) => ({ ...f, counterId: e.target.value.toUpperCase() }))} className="input-base font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">
                {editing ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-base" required={!editing} minLength={6} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!deactivateTarget}
        title="Nonaktifkan Pengguna?"
        description={`Pengguna ${deactivateTarget?.name} (${deactivateTarget?.userId}) tidak akan bisa login lagi.`}
        confirmLabel="Ya, Nonaktifkan"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <GenericImportModal
        open={importOpen}
        title="Import Pengguna"
        importUrl="/api/users/import"
        templateUrl="/api/users/template"
        templateFileLabel="Download template CSV pengguna"
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); fetchData(); }}
        resultStats={[
          { key: 'totalRows', label: 'Total Baris' },
          { key: 'created', label: 'Pengguna Baru', tone: 'brand' },
          { key: 'updated', label: 'Diperbarui' },
        ]}
      />
    </div>
  );
}
