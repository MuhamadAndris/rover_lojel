import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction } from '@/models';
import { notFound } from 'next/navigation';
import TransactionForm from '../../TransactionForm';

interface Props {
  params: { transactionId: string };
}

export default async function EditTransactionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  await connectDB();
  const txn = await Transaction.findOne({ transactionId: params.transactionId }).lean();
  if (!txn) notFound();

  return (
    <div className="max-w-6xl mx-auto">
      <TransactionForm
        mode="edit"
        initialData={{
          transactionId: txn.transactionId,
          date: new Date(txn.date).toISOString().slice(0, 10),
          counterId: txn.counterId,
          bonNumber: txn.bonNumber,
          saleByUserId: txn.saleByUserId,
          postByUserId: txn.postByUserId,
          spvId: txn.spvId,
          status: txn.status,
          notes: txn.notes || '',
          items: txn.items.map((it) => ({
            itemId: it.itemId,
            productId: it.productId,
            productDescription: it.productDescription,
            qty: it.qty,
            normalPrice: it.normalPrice,
            promoDescription: it.promoDescription || '',
            promoValue: it.promoValue,
            finalPrice: it.finalPrice,
          })),
        }}
      />
    </div>
  );
}
