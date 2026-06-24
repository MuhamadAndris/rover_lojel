'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui';
import { XCircle, RefreshCw, Pencil } from 'lucide-react';
import Link from 'next/link';

interface Props {
  transactionId: string;
  currentStatus: string;
}

export default function TransactionStatusActions({ transactionId, currentStatus }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<'cancel' | 'exchange' | null>(null);
  const [loading, setLoading] = useState(false);

  async function changeStatus(newStatus: 'cancel' | 'exchange') {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Status berhasil diubah');
      setModal(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/dashboard/transactions/${transactionId}/edit`}
          className="btn-secondary text-xs"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Link>
        {currentStatus === 'success' && (
          <>
            <button
              onClick={() => setModal('exchange')}
              className="btn-secondary text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tukar Barang
            </button>
            <button
              onClick={() => setModal('cancel')}
              className="btn-secondary text-xs text-rose-500 border-rose-200 hover:bg-rose-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Batalkan
            </button>
          </>
        )}
      </div>

      <ConfirmModal
        open={modal === 'cancel'}
        title="Batalkan Transaksi?"
        description="Stok produk akan dikembalikan secara otomatis. Pastikan ini sudah sesuai keputusan SPV."
        confirmLabel="Ya, Batalkan"
        variant="danger"
        loading={loading}
        onConfirm={() => changeStatus('cancel')}
        onCancel={() => setModal(null)}
      />

      <ConfirmModal
        open={modal === 'exchange'}
        title="Tandai Tukar Barang?"
        description="Transaksi akan ditandai sebagai tukar barang dan stok dikembalikan. SPV harus sudah menyetujui."
        confirmLabel="Ya, Tukar Barang"
        loading={loading}
        onConfirm={() => changeStatus('exchange')}
        onCancel={() => setModal(null)}
      />
    </>
  );
}
