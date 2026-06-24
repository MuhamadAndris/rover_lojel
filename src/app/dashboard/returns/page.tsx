'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, RefreshCw, Upload, X, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, generateItemId } from '@/lib/utils';
import Pagination from '@/components/Pagination';
import { LoadingSpinner, EmptyState } from '@/components/ui';
import GenericImportModal from '@/components/GenericImportModal';

interface ReturnItem {
  itemId: string;
  productId: string;
  productDescription: string;
  qty: number;
  reason?: string;
}

interface ReturnRecord {
  _id: string;
  returnId: string;
  date: string;
  counterId: string;
  supplierName?: string;
  deliveryNoteNumber?: string;
  deliveryNotePhoto?: string | null;
  items: ReturnItem[];
  totalQty: number;
  status: string;
}

export default function ReturnStockPage() {
  const [data, setData] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/stock-returns?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotalPages(json.pagination?.totalPages ?? 1);
      setTotal(json.pagination?.total ?? 0);
    } catch { toast.error('Gagal memuat data'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Cari ID, nomor surat jalan, supplier…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-base pl-9" />
        </div>
        <button onClick={fetchData} className="btn-secondary"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setImportOpen(true)} className="btn-secondary text-xs"><Upload className="w-3.5 h-3.5" /> Import</button>
        <button onClick={() => setFormOpen(true)} className="btn-primary ml-auto"><Plus className="w-4 h-4" /> Catat Return Barang</button>
      </div>

      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                {['ID', 'Tanggal', 'Counter', 'Supplier', 'No. Surat Jalan', 'Item', 'Qty', 'Foto'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {loading ? <tr><td colSpan={8}><LoadingSpinner /></td></tr>
              : data.length === 0 ? <tr><td colSpan={8}><EmptyState title="Belum ada data return barang" description="Catat pengembalian barang ke supplier." action={<button onClick={() => setFormOpen(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Catat Return Barang</button>} /></td></tr>
              : data.map((r) => (
                <tr key={r._id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700">{r.returnId}</td>
                  <td className="px-4 py-3 text-xs text-ink-600 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded">{r.counterId}</span></td>
                  <td className="px-4 py-3 text-ink-600 text-xs">{r.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-ink-600 text-xs">{r.deliveryNoteNumber || '—'}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{r.items.length} jenis</td>
                  <td className="px-4 py-3 font-semibold text-rose-500">−{r.totalQty}</td>
                  <td className="px-4 py-3">
                    {r.deliveryNotePhoto ? (
                      <a href={r.deliveryNotePhoto} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Lihat
                      </a>
                    ) : <span className="text-ink-300 text-xs">—</span>}
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
        <ReturnForm onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); fetchData(); }} />
      )}

      <GenericImportModal
        open={importOpen}
        title="Import Return Barang"
        importUrl="/api/stock-returns/import"
        templateUrl="/api/stock-returns/template"
        templateFileLabel="Download template CSV return barang"
        onClose={() => setImportOpen(false)}
        onSuccess={() => { setImportOpen(false); fetchData(); }}
        resultStats={[
          { key: 'totalRows', label: 'Total Baris' },
          { key: 'documentsCreated', label: 'Dokumen Dibuat', tone: 'brand' },
          { key: 'itemsImported', label: 'Item Diimpor' },
        ]}
      />
    </div>
  );
}

/* ---------------- FORM ---------------- */
function ReturnForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [counterId, setCounterId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [items, setItems] = useState<ReturnItem[]>([
    { itemId: generateItemId(), productId: '', productDescription: '', qty: 1, reason: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addItem() {
    setItems((prev) => [...prev, { itemId: generateItemId(), productId: '', productDescription: '', qty: 1, reason: '' }]);
  }
  function updateItem(idx: number, field: keyof ReturnItem, value: string | number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function removeItem(idx: number) {
    if (items.length === 1) return toast.error('Minimal 1 item');
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/stock-returns/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPhoto(json.url);
      toast.success('Foto surat jalan terupload');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal upload foto');
    } finally { setUploadingPhoto(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = items.some((it) => !it.productId || it.qty < 1);
    if (invalid) return toast.error('Lengkapi data semua item');

    setSaving(true);
    try {
      const res = await fetch('/api/stock-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, counterId, supplierName, deliveryNoteNumber,
          deliveryNotePhoto: photo, items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Return barang berhasil dicatat. Stok ter-update otomatis.');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-xl2 shadow-panel w-full max-w-2xl mx-4 p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink-900">Catat Return Barang</h2>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tanggal</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Counter ID</label>
            <input type="text" maxLength={3} placeholder="0E1" value={counterId} onChange={(e) => setCounterId(e.target.value.toUpperCase())} className="input-base font-mono" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Nama Supplier</label>
            <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input-base" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Nomor Surat Jalan Retur</label>
            <input type="text" value={deliveryNoteNumber} onChange={(e) => setDeliveryNoteNumber(e.target.value)} className="input-base" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Foto Surat Jalan</label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
          {photo ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-ink-200">
              <img src={photo} alt="Surat jalan" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhoto(null)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink-950/70 flex items-center justify-center text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} className="btn-secondary text-xs">
              {uploadingPhoto ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengupload...</> : <><Upload className="w-3.5 h-3.5" /> Upload Foto</>}
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-ink-600">Item Barang</label>
            <button type="button" onClick={addItem} className="btn-secondary text-xs"><Plus className="w-3 h-3" /> Tambah</button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.itemId} className="flex gap-2">
                <input type="text" placeholder="Product ID" value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)} className="input-base font-mono text-xs flex-1" required />
                <input type="text" placeholder="Deskripsi" value={item.productDescription} onChange={(e) => updateItem(idx, 'productDescription', e.target.value)} className="input-base text-xs flex-1" required />
                <input type="number" min={1} placeholder="Qty" value={item.qty} onChange={(e) => updateItem(idx, 'qty', parseInt(e.target.value) || 1)} className="input-base text-xs w-16 text-center" required />
                <input type="text" placeholder="Alasan" value={item.reason} onChange={(e) => updateItem(idx, 'reason', e.target.value)} className="input-base text-xs flex-1" />
                <button type="button" onClick={() => removeItem(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-rose-500 hover:bg-rose-50 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-secondary">Batal</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan…' : 'Simpan & Update Stok'}</button>
        </div>
      </form>
    </div>
  );
}
