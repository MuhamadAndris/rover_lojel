import { Stock, StockLedger } from '@/models';
import type { StockMovementType } from '@/models';

interface MovementInput {
  date: Date;
  productId: string;
  productDescription: string;
  counterId: string;
  qtyIn?: number;
  qtyOut?: number;
  movementType: StockMovementType;
  referenceType: 'StockIncoming' | 'StockReturn' | 'Transaction' | 'Manual';
  referenceId: string;
  deliveryNoteNumber?: string;
  notes?: string;
  createdBy: string;
}

/**
 * Applies a single stock movement: updates (or creates) the Stock balance
 * document and appends an entry to the StockLedger ("buku stok").
 * This should be called inside the same logical operation that creates
 * the source document (StockIncoming/StockReturn/Transaction) so balances
 * never drift out of sync.
 */
export async function applyStockMovement(input: MovementInput) {
  const qtyIn = input.qtyIn ?? 0;
  const qtyOut = input.qtyOut ?? 0;
  const delta = qtyIn - qtyOut;

  const stock = await Stock.findOneAndUpdate(
    { productId: input.productId, counterId: input.counterId },
    {
      $inc: { qtyOnHand: delta },
      $set: {
        productDescription: input.productDescription,
        lastMovementAt: input.date,
      },
    },
    { upsert: true, new: true }
  );

  await StockLedger.create({
    date: input.date,
    productId: input.productId,
    productDescription: input.productDescription,
    counterId: input.counterId,
    movementType: input.movementType,
    qtyIn,
    qtyOut,
    balanceAfter: stock.qtyOnHand,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    deliveryNoteNumber: input.deliveryNoteNumber,
    notes: input.notes,
    createdBy: input.createdBy,
  });

  return stock;
}

/** Apply stock movements for every line item of a StockIncoming document. */
export async function applyIncomingStock(params: {
  incomingId: string;
  date: Date;
  counterId: string;
  items: { productId: string; productDescription: string; qty: number }[];
  createdBy: string;
  deliveryNoteNumber?: string;
}) {
  for (const item of params.items) {
    await applyStockMovement({
      date: params.date,
      productId: item.productId,
      productDescription: item.productDescription,
      counterId: params.counterId,
      qtyIn: item.qty,
      movementType: 'incoming',
      referenceType: 'StockIncoming',
      referenceId: params.incomingId,
      deliveryNoteNumber: params.deliveryNoteNumber,
      createdBy: params.createdBy,
    });
  }
}

/** Apply stock movements for every line item of a StockReturn document. */
export async function applyReturnStock(params: {
  returnId: string;
  date: Date;
  counterId: string;
  items: { productId: string; productDescription: string; qty: number }[];
  createdBy: string;
  deliveryNoteNumber?: string;
}) {
  for (const item of params.items) {
    await applyStockMovement({
      date: params.date,
      productId: item.productId,
      productDescription: item.productDescription,
      counterId: params.counterId,
      qtyOut: item.qty,
      movementType: 'return_out',
      referenceType: 'StockReturn',
      referenceId: params.returnId,
      deliveryNoteNumber: params.deliveryNoteNumber,
      createdBy: params.createdBy,
    });
  }
}

/** Deduct stock when a transaction is recorded as a successful sale. */
export async function applySaleStock(params: {
  transactionId: string;
  date: Date;
  counterId: string;
  items: { productId: string; productDescription: string; qty: number }[];
  createdBy: string;
  bonNumber?: string;
}) {
  for (const item of params.items) {
    await applyStockMovement({
      date: params.date,
      productId: item.productId,
      productDescription: item.productDescription,
      counterId: params.counterId,
      qtyOut: item.qty,
      movementType: 'sale',
      referenceType: 'Transaction',
      referenceId: params.transactionId,
      deliveryNoteNumber: params.bonNumber,
      createdBy: params.createdBy,
    });
  }
}

/** Reverse a previous sale's stock deduction (used when a transaction is cancelled or exchanged). */
export async function reverseSaleStock(params: {
  transactionId: string;
  date: Date;
  counterId: string;
  items: { productId: string; productDescription: string; qty: number }[];
  createdBy: string;
  reason: 'cancel' | 'exchange';
  bonNumber?: string;
}) {
  for (const item of params.items) {
    await applyStockMovement({
      date: params.date,
      productId: item.productId,
      productDescription: item.productDescription,
      counterId: params.counterId,
      qtyIn: item.qty,
      movementType: 'sale_reversal',
      referenceType: 'Transaction',
      referenceId: params.transactionId,
      deliveryNoteNumber: params.bonNumber,
      notes: `Reversal due to status: ${params.reason}`,
      createdBy: params.createdBy,
    });
  }
}
