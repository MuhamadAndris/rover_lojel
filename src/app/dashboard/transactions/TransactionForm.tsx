'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Plus, Trash2, Search, Loader2, ChevronDown, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, generateItemId, calcPromoValueFromDescription } from '@/lib/utils';

interface ProductHit {
  productId: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  description: string;
  activePromo: {
    promoDescription: string;
    promoValue: number;
    normalPrice: number;
    finalPrice: number;
  } | null;
}

interface UserHit {
  userId: string;
  name: string;
  role: string;
}

interface LineItem {
  itemId: string;
  productId: string;
  productDescription: string;
  qty: number;
  normalPrice: number;
  promoDescription: string;
  promoValue: number;
  finalPrice: number;
}

interface FormState {
  date: string;
  counterId: string;
  bonNumber: string;
  saleByUserId: string;
  postByUserId: string;
  spvId: string;
  status: 'success' | 'cancel' | 'exchange';
  notes: string;
}

interface Props {
  mode: 'new' | 'edit';
  initialData?: Partial<FormState & { transactionId: string; items: LineItem[] }>;
}

/* ---- small inline autocomplete ---- */
function UserPicker({
  label,
  value,
  onChange,
  roleFilter,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  roleFilter?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<UserHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  function search(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setHits([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const params = new URLSearchParams({ q });
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/users/lookup?${params}`);
      const json = await res.json();
      setHits(json.data ?? []);
      setOpen(true);
    }, 250);
  }

  function select(u: UserHit) {
    setQuery(u.userId);
    onChange(u.userId);
    setOpen(false);
    setHits([]);
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-ink-600 mb-1">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={7}
        placeholder="7 digit ID…"
        value={query}
        disabled={disabled}
        onChange={(e) => search(e.target.value.replace(/\D/g, ''))}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input-base font-mono text-sm disabled:bg-ink-50"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-ink-200 rounded-xl shadow-panel max-h-48 overflow-y-auto text-sm">
          {hits.map((u) => (
            <li
              key={u.userId}
              onMouseDown={() => select(u)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-ink-50 cursor-pointer"
            >
              <span className="font-mono text-ink-700">{u.userId}</span>
              <span className="text-ink-400 text-xs truncate">{u.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---- product search row ---- */
function ProductRow({
  item,
  onChange,
  onRemove,
}: {
  item: LineItem;
  onChange: (updated: LineItem) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState(item.productId || item.productDescription || '');
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchProduct(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setHits([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setHits(json.data ?? []);
      setOpen(true);
    }, 250);
  }

  function selectProduct(p: ProductHit) {
    setQuery(p.productId);
    setOpen(false);
    setHits([]);
    const promo = p.activePromo;
    const normalPrice = promo?.normalPrice ?? item.normalPrice;
    const promoDesc = promo?.promoDescription ?? '';
    const promoValue = promo ? promo.promoValue * item.qty : 0;
    const finalPrice = promo
      ? promo.finalPrice * item.qty
      : normalPrice * item.qty;
    onChange({
      ...item,
      productId: p.productId,
      productDescription: p.description,
      normalPrice,
      promoDescription: promoDesc,
      promoValue,
      finalPrice,
    });
  }

  function recalc(updates: Partial<LineItem>) {
    const merged = { ...item, ...updates };
    // Auto-calc promoValue if promoDescription changed and it's a percentage/B1G1
    if ('promoDescription' in updates || 'qty' in updates || 'normalPrice' in updates) {
      const autoPromo = merged.promoDescription
        ? calcPromoValueFromDescription(merged.promoDescription, merged.normalPrice, merged.qty)
        : null;
      if (autoPromo !== null && autoPromo > 0) {
        merged.promoValue = autoPromo;
      }
      merged.finalPrice = merged.normalPrice * merged.qty - merged.promoValue;
    }
    onChange(merged);
  }

  return (
    <tr className="border-b border-ink-50 last:border-0">
      {/* Product search */}
      <td className="p-2 min-w-56">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-300" />
          <input
            type="text"
            placeholder="Cari ID / nama produk…"
            value={query}
            onChange={(e) => searchProduct(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="input-base pl-7 text-xs"
          />
          {open && hits.length > 0 && (
            <ul className="absolute z-20 top-full left-0 w-72 mt-1 bg-white border border-ink-200 rounded-xl shadow-panel text-xs max-h-52 overflow-y-auto">
              {hits.map((h) => (
                <li
                  key={h.productId}
                  onMouseDown={() => selectProduct(h)}
                  className="px-3 py-2.5 hover:bg-ink-50 cursor-pointer border-b border-ink-50 last:border-0"
                >
                  <p className="font-mono text-ink-700 font-medium">{h.productId}</p>
                  <p className="text-ink-500 mt-0.5">{h.description}</p>
                  {h.activePromo && (
                    <p className="text-brand-600 mt-0.5 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Promo: {h.activePromo.promoDescription} → {formatCurrency(h.activePromo.finalPrice)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {item.productDescription && (
          <p className="text-[11px] text-ink-400 mt-0.5 truncate max-w-56" title={item.productDescription}>
            {item.productDescription}
          </p>
        )}
      </td>

      {/* Qty */}
      <td className="p-2 w-16">
        <input
          type="number"
          min={1}
          value={item.qty}
          onChange={(e) => recalc({ qty: parseInt(e.target.value) || 1 })}
          className="input-base text-center text-sm w-16"
        />
      </td>

      {/* Normal price */}
      <td className="p-2 w-32">
        <input
          type="number"
          min={0}
          value={item.normalPrice}
          onChange={(e) => recalc({ normalPrice: parseFloat(e.target.value) || 0 })}
          className="input-base text-right text-sm"
        />
      </td>

      {/* Promo desc */}
      <td className="p-2 w-36">
        <input
          type="text"
          placeholder="10%, BUY 1 GET 1…"
          value={item.promoDescription}
          onChange={(e) => recalc({ promoDescription: e.target.value })}
          className="input-base text-sm"
        />
      </td>

      {/* Promo value */}
      <td className="p-2 w-28">
        <input
          type="number"
          min={0}
          value={item.promoValue}
          onChange={(e) => {
            const v = parseFloat(e.target.value) || 0;
            onChange({ ...item, promoValue: v, finalPrice: item.normalPrice * item.qty - v });
          }}
          className="input-base text-right text-sm"
        />
      </td>

      {/* Final price */}
      <td className="p-2 w-32">
        <input
          type="number"
          min={0}
          value={item.finalPrice}
          onChange={(e) => onChange({ ...item, finalPrice: parseFloat(e.target.value) || 0 })}
          className="input-base text-right text-sm"
        />
      </td>

      {/* Remove */}
      <td className="p-2 w-10">
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

/* =================== MAIN FORM =================== */
export default function TransactionForm({ mode, initialData }: Props) {
  const router = useRouter();
  const { data: session } = useSession();

  const [nextId, setNextId] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>({
    date: new Date().toISOString().slice(0, 10),
    counterId: session?.user?.counterId ?? '',
    bonNumber: '',
    saleByUserId: session?.user?.role === 'sa' ? session.user.userId : '',
    postByUserId: session?.user?.userId ?? '',
    spvId: '',
    status: 'success',
    notes: '',
    ...initialData,
  });

  const [items, setItems] = useState<LineItem[]>(
    initialData?.items ?? [
      {
        itemId: generateItemId(),
        productId: '',
        productDescription: '',
        qty: 1,
        normalPrice: 0,
        promoDescription: '',
        promoValue: 0,
        finalPrice: 0,
      },
    ]
  );

  useEffect(() => {
    if (mode === 'new') {
      fetch('/api/transactions/next-id')
        .then((r) => r.json())
        .then((j) => setNextId(j.transactionId));
    } else if (initialData?.transactionId) {
      setNextId(initialData.transactionId);
    }
  }, [mode, initialData?.transactionId]);

  // Session loads asynchronously — the initial useState() call for `form`
  // often runs before session.user is available, leaving postByUserId /
  // saleByUserId / counterId blank. Backfill them once session resolves,
  // but only if the user hasn't already typed something in those fields.
  useEffect(() => {
    if (!session?.user || mode === 'edit') return;
    setForm((f) => ({
      ...f,
      postByUserId: f.postByUserId || session.user.userId,
      saleByUserId:
        session.user.role === 'sa' ? session.user.userId : f.saleByUserId,
      counterId: f.counterId || session.user.counterId || '',
    }));
  }, [session, mode]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        itemId: generateItemId(),
        productId: '',
        productDescription: '',
        qty: 1,
        normalPrice: 0,
        promoDescription: '',
        promoValue: 0,
        finalPrice: 0,
      },
    ]);
  }

  function updateItem(idx: number, updated: LineItem) {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  }

  function removeItem(idx: number) {
    if (items.length === 1) {
      toast.error('Minimal 1 item produk');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const totalNormal = items.reduce((s, it) => s + it.normalPrice * it.qty, 0);
  const totalDiskon = items.reduce((s, it) => s + it.promoValue, 0);
  const totalFinal = items.reduce((s, it) => s + it.finalPrice, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const invalidItems = items.filter((it) => !it.productId || it.qty < 1);
    if (invalidItems.length > 0) {
      toast.error('Lengkapi data produk di semua baris item');
      return;
    }

    if (!/^\d{7}$/.test(form.saleByUserId)) {
      toast.error('Pilih Sale by (SA) yang valid — harus 7 digit angka');
      return;
    }
    if (!/^\d{7}$/.test(form.postByUserId)) {
      toast.error('Pilih Post by yang valid — harus 7 digit angka');
      return;
    }
    if (!/^\d{7}$/.test(form.spvId)) {
      toast.error('Pilih SPV yang valid — harus 7 digit angka');
      return;
    }
    if (!/^[A-Za-z0-9]{3}$/.test(form.counterId)) {
      toast.error('Counter ID harus 3 karakter');
      return;
    }
    if (!form.bonNumber.trim()) {
      toast.error('Nomor bon wajib diisi');
      return;
    }

    setLoading(true);
    const editTransactionId = mode === 'edit' ? initialData?.transactionId : undefined;
    const payload = { ...form, items };

    try {
      const res = await fetch(
        mode === 'new'
          ? '/api/transactions'
          : `/api/transactions/${editTransactionId}`,
        {
          method: mode === 'new' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        // Surface field-level Zod errors instead of a generic message
        const fieldErrors = json?.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        if (fieldErrors) {
          const firstField = Object.keys(fieldErrors)[0];
          const firstMessage = fieldErrors[firstField]?.[0];
          throw new Error(
            firstMessage ? `${firstField}: ${firstMessage}` : json.error
          );
        }
        throw new Error(json.error || 'Gagal menyimpan transaksi');
      }
      toast.success(mode === 'new' ? 'Transaksi berhasil dibuat' : 'Transaksi berhasil diperbarui');
      router.push(`/dashboard/transactions/${json.data.transactionId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  const isSA = session?.user?.role === 'sa';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card p-5">
        <h2 className="font-semibold text-ink-800 mb-4 text-sm">Informasi Transaksi</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">ID Transaksi</label>
            <input
              type="text"
              value={nextId}
              readOnly
              className="input-base font-mono text-sm bg-ink-50 text-ink-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Tanggal</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="input-base text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Counter ID</label>
            <input
              type="text"
              maxLength={3}
              placeholder="0E1"
              value={form.counterId}
              onChange={(e) => setForm((f) => ({ ...f, counterId: e.target.value.toUpperCase() }))}
              className="input-base font-mono text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Nomor Bon</label>
            <input
              type="text"
              placeholder="BON0001"
              value={form.bonNumber}
              onChange={(e) => setForm((f) => ({ ...f, bonNumber: e.target.value }))}
              className="input-base text-sm"
              required
            />
          </div>

          <UserPicker
            label="Sale by (SA)"
            value={form.saleByUserId}
            onChange={(v) => setForm((f) => ({ ...f, saleByUserId: v }))}
            roleFilter="sa"
            disabled={isSA}
          />
          <UserPicker
            label="Post by"
            value={form.postByUserId}
            onChange={(v) => setForm((f) => ({ ...f, postByUserId: v }))}
          />
          <UserPicker
            label="SPV"
            value={form.spvId}
            onChange={(v) => setForm((f) => ({ ...f, spvId: v }))}
            roleFilter="spv"
          />

          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as FormState['status'] }))
                }
                className="input-base text-sm appearance-none pr-8"
              >
                <option value="success">Sukses</option>
                <option value="cancel">Dibatalkan</option>
                <option value="exchange">Tukar Barang</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
            </div>
          </div>

          <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <label className="block text-xs font-medium text-ink-600 mb-1">Catatan (opsional)</label>
            <textarea
              rows={2}
              placeholder="Tambahkan catatan jika perlu…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-base text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <h2 className="font-semibold text-ink-800 text-sm">Item Produk</h2>
          <button type="button" onClick={addItem} className="btn-secondary text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah Item
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="text-left px-2 py-2 text-xs font-medium text-ink-500">Produk</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-ink-500">Qty</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-ink-500">Harga Normal</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-ink-500">Promo</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-ink-500">Nilai Promo</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-ink-500">Harga Akhir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <ProductRow
                  key={item.itemId}
                  item={item}
                  onChange={(updated) => updateItem(idx, updated)}
                  onRemove={() => removeItem(idx)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div className="border-t border-ink-100 px-5 py-3 bg-ink-50 flex items-center justify-end gap-6 text-sm">
          <span className="text-ink-500">Total Qty: <strong className="text-ink-800">{totalQty}</strong></span>
          <span className="text-ink-500">
            Harga Normal: <strong className="text-ink-800">{formatCurrency(totalNormal)}</strong>
          </span>
          <span className="text-rose-500">
            Diskon: <strong>−{formatCurrency(totalDiskon)}</strong>
          </span>
          <span className="text-brand-700 font-semibold text-base">
            Total: {formatCurrency(totalFinal)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={loading}
        >
          Batal
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : mode === 'new' ? (
            'Simpan Transaksi'
          ) : (
            'Perbarui Transaksi'
          )}
        </button>
      </div>
    </form>
  );
}
