import { Transaction } from '@/models';
import type { ITransaction, ITransactionItem, TransactionStatus } from '@/models';
import { applySaleStock, reverseSaleStock } from './stockService';

interface CreateTransactionInput {
  transactionId: string;
  date: Date;
  counterId: string;
  bonNumber: string;
  items: ITransactionItem[];
  saleByUserId: string;
  postByUserId: string;
  spvId: string;
  status: TransactionStatus;
  notes?: string;
  source?: 'manual' | 'import';
}

/**
 * Creates a transaction and, if its initial status is "success",
 * immediately deducts stock. Transactions created as "cancel" never
 * touch stock. "exchange" is unusual as an initial status (it normally
 * results from an edit) but is handled the same way as success for
 * consistency: the original sale's stock effect was already applied at
 * sale-time, so this only fires on transition, not on initial create with
 * type exchange (rare/import edge case) — see comment below.
 */
export async function createTransaction(input: CreateTransactionInput) {
  const txn = await Transaction.create({
    transactionId: input.transactionId,
    date: input.date,
    counterId: input.counterId,
    bonNumber: input.bonNumber,
    items: input.items,
    saleByUserId: input.saleByUserId,
    postByUserId: input.postByUserId,
    spvId: input.spvId,
    status: input.status,
    notes: input.notes,
    source: input.source ?? 'manual',
  });

  if (input.status === 'success') {
    await applySaleStock({
      transactionId: txn.transactionId,
      date: txn.date,
      counterId: txn.counterId,
      items: txn.items.map((it) => ({
        productId: it.productId,
        productDescription: it.productDescription,
        qty: it.qty,
      })),
      createdBy: input.postByUserId,
      bonNumber: txn.bonNumber,
    });
  }

  return txn;
}

/**
 * Changes a transaction's status and applies the correct stock side-effect:
 *  - success -> cancel    : reverse the stock deduction (stock goes back up)
 *  - success -> exchange  : reverse the stock deduction (item is being swapped)
 *  - cancel  -> success   : re-apply the stock deduction
 *  - any no-op transition : does nothing
 */
export async function changeTransactionStatus(
  transactionId: string,
  newStatus: TransactionStatus,
  changedBy: string
): Promise<ITransaction> {
  const txn = await Transaction.findOne({ transactionId });
  if (!txn) {
    throw new Error('Transaksi tidak ditemukan');
  }

  const oldStatus = txn.status;
  if (oldStatus === newStatus) {
    return txn;
  }

  const items = txn.items.map((it) => ({
    productId: it.productId,
    productDescription: it.productDescription,
    qty: it.qty,
  }));

  const wasDeducted = oldStatus === 'success';
  const willBeDeducted = newStatus === 'success';

  if (wasDeducted && !willBeDeducted) {
    // success -> cancel/exchange: give stock back
    await reverseSaleStock({
      transactionId: txn.transactionId,
      date: new Date(),
      counterId: txn.counterId,
      items,
      createdBy: changedBy,
      reason: newStatus === 'cancel' ? 'cancel' : 'exchange',
      bonNumber: txn.bonNumber,
    });
  } else if (!wasDeducted && willBeDeducted) {
    // cancel -> success: deduct stock again
    await applySaleStock({
      transactionId: txn.transactionId,
      date: new Date(),
      counterId: txn.counterId,
      items,
      createdBy: changedBy,
      bonNumber: txn.bonNumber,
    });
  }
  // exchange <-> cancel: neither state holds stock deducted, so no movement needed

  txn.status = newStatus;
  await txn.save();
  return txn;
}
