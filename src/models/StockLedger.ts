import { Schema, model, models, Document, Model } from 'mongoose';

export type StockMovementType =
  | 'incoming' // from StockIncoming
  | 'return_out' // from StockReturn (out to supplier)
  | 'sale' // from Transaction status=success
  | 'sale_reversal' // from Transaction status changed to cancel/exchange
  | 'adjustment'; // manual correction

/**
 * StockLedger is the append-only "buku stok" (stock book) — every single
 * movement in/out per product per counter, with a running balance.
 * This is what gets exported to spreadsheet/Excel for the stock report.
 */
export interface IStockLedger extends Document {
  date: Date;
  productId: string;
  productDescription: string;
  counterId: string;
  movementType: StockMovementType;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  referenceType: 'StockIncoming' | 'StockReturn' | 'Transaction' | 'Manual';
  referenceId: string; // incomingId / returnId / transactionId
  deliveryNoteNumber?: string; // surat jalan datang/return, for the "keterangan" column
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

const StockLedgerSchema = new Schema<IStockLedger>(
  {
    date: { type: Date, required: true, index: true },
    productId: { type: String, required: true, match: /^\d{9}$/, index: true },
    productDescription: { type: String, required: true },
    counterId: {
      type: String,
      required: true,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
      index: true,
    },
    movementType: {
      type: String,
      enum: ['incoming', 'return_out', 'sale', 'sale_reversal', 'adjustment'],
      required: true,
    },
    qtyIn: { type: Number, required: true, default: 0 },
    qtyOut: { type: Number, required: true, default: 0 },
    balanceAfter: { type: Number, required: true },
    referenceType: {
      type: String,
      enum: ['StockIncoming', 'StockReturn', 'Transaction', 'Manual'],
      required: true,
    },
    referenceId: { type: String, required: true, index: true },
    deliveryNoteNumber: { type: String },
    notes: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockLedgerSchema.index({ productId: 1, counterId: 1, date: 1 });

const StockLedger: Model<IStockLedger> =
  models.StockLedger || model<IStockLedger>('StockLedger', StockLedgerSchema);

export default StockLedger;
