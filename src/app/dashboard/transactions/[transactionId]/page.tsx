import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction } from '@/models';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import { hasPermission } from '@/lib/rbac';
import StatusBadge from '@/components/StatusBadge';
import type { UserRole } from '@/models';
import {
  ArrowLeft,
  Calendar,
  Hash,
  Store,
  User,
  ClipboardList,
} from 'lucide-react';
import TransactionStatusActions from './TransactionStatusActions';

interface Props {
  params: { transactionId: string };
}

export default async function TransactionDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  await connectDB();
  const txn = await Transaction.findOne({ transactionId: params.transactionId }).lean();
  if (!txn) notFound();

  // SA can only see their own
  if (session.user.role === 'sa' && txn.saleByUserId !== session.user.userId) {
    notFound();
  }

  const role = session.user.role as UserRole;
  const canEdit = hasPermission(role, 'transaction:edit');

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/transactions"
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-brand-600 mb-3 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-semibold text-xl text-ink-900 font-mono">
              {txn.transactionId}
            </h1>
            <StatusBadge status={txn.status} />
          </div>
          <p className="text-sm text-ink-400 mt-0.5">
            Dibuat {formatDate(txn.createdAt as Date, true)} · Sumber: {txn.source === 'import' ? 'Import' : 'Manual'}
          </p>
        </div>
        {canEdit && (
          <TransactionStatusActions
            transactionId={txn.transactionId}
            currentStatus={txn.status}
          />
        )}
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { icon: Calendar, label: 'Tanggal', value: formatDate(txn.date) },
          { icon: Store, label: 'Counter', value: txn.counterId },
          { icon: Hash, label: 'Nomor Bon', value: txn.bonNumber },
          { icon: User, label: 'SA', value: txn.saleByUserId },
          { icon: User, label: 'SPV', value: txn.spvId },
          { icon: User, label: 'Post by', value: txn.postByUserId },
          { icon: ClipboardList, label: 'Total Item', value: `${txn.totalQty} pcs` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-ink-100 px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3.5 h-3.5 text-ink-400" />
              <p className="text-xs text-ink-400">{label}</p>
            </div>
            <p className="font-mono text-sm font-medium text-ink-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl2 border border-ink-100 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100">
          <h2 className="font-semibold text-ink-800 text-sm">Item Produk</h2>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Product ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Deskripsi</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Qty</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Harga Normal</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Promo</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Diskon</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Harga Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {txn.items.map((item) => (
                <tr key={item.itemId}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-ink-700">{item.productId}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-600 text-xs max-w-xs">{item.productDescription}</td>
                  <td className="px-4 py-3 text-right">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-ink-600">
                    {formatCurrency(item.normalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    {item.promoDescription ? (
                      <span className="badge bg-amber-100 text-amber-600">
                        {item.promoDescription}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-500 text-xs">
                    {item.promoValue > 0 ? `−${formatCurrency(item.promoValue)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink-900">
                    {formatCurrency(item.finalPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200 bg-ink-50">
                <td colSpan={2} className="px-4 py-3 font-semibold text-ink-700 text-sm">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-semibold">{txn.totalQty}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink-700">
                  {formatCurrency(txn.totalNormalAmount)}
                </td>
                <td />
                <td className="px-4 py-3 text-right font-semibold text-rose-500">
                  {txn.totalPromoValue > 0 ? `−${formatCurrency(txn.totalPromoValue)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-bold text-brand-700 text-base">
                  {formatCurrency(txn.totalFinalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {txn.notes && (
        <div className="bg-white rounded-xl2 border border-ink-100 shadow-card p-5">
          <p className="text-xs font-medium text-ink-400 mb-1">Catatan</p>
          <p className="text-sm text-ink-700">{txn.notes}</p>
        </div>
      )}
    </div>
  );
}
