import { Schema, model, models, Document, Model } from 'mongoose';

export type TransactionStatus = 'success' | 'cancel' | 'exchange';

export interface ITransactionItem {
  itemId: string; // generated, unique within the transaction (for edit/delete in UI)
  productId: string; // 9-digit string
  productDescription: string; // brand + name + size + color, snapshotted at sale time
  qty: number;
  normalPrice: number;
  promoDescription: string | null; // "10%", "20+10%", "SPECIAL PRICE", "BUY 1 GET 1", etc
  promoValue: number; // total discount amount for this line (qty considered)
  finalPrice: number; // normalPrice * qty - promoValue (per-line total, after discount)
}

export interface ITransaction extends Document {
  transactionId: string; // human-facing unique id, e.g. "TRX-20260618-0001"
  date: Date; // transaction date (can differ from createdAt for backdated import)
  counterId: string; // 3-char counter code, e.g. "0E1", "ST1", "079"
  bonNumber: string;
  items: ITransactionItem[];
  saleByUserId: string; // 7-digit SA id
  postByUserId: string; // 7-digit id of whoever recorded/posted the report
  spvId: string; // 7-digit SPV id
  status: TransactionStatus;
  totalQty: number; // derived, kept denormalized for fast reporting
  totalNormalAmount: number; // derived
  totalPromoValue: number; // derived
  totalFinalAmount: number; // derived
  notes?: string;
  source: 'manual' | 'import'; // how this record entered the system
  createdAt: Date;
  updatedAt: Date;
}

const TransactionItemSchema = new Schema<ITransactionItem>(
  {
    itemId: { type: String, required: true },
    productId: { type: String, required: true, match: /^\d{9}$/ },
    productDescription: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    normalPrice: { type: Number, required: true, min: 0 },
    promoDescription: { type: String, default: null },
    promoValue: { type: Number, required: true, default: 0, min: 0 },
    finalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true, index: true },
    counterId: {
      type: String,
      required: true,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
      index: true,
    },
    bonNumber: { type: String, required: true, trim: true, index: true },
    items: {
      type: [TransactionItemSchema],
      required: true,
      validate: {
        validator: (v: ITransactionItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Transaction must have at least one item',
      },
    },
    saleByUserId: { type: String, required: true, match: /^\d{7}$/, index: true },
    postByUserId: { type: String, required: true, match: /^\d{7}$/ },
    spvId: { type: String, required: true, match: /^\d{7}$/, index: true },
    status: {
      type: String,
      enum: ['success', 'cancel', 'exchange'],
      default: 'success',
      index: true,
    },
    totalQty: { type: Number, required: true, default: 0 },
    totalNormalAmount: { type: Number, required: true, default: 0 },
    totalPromoValue: { type: Number, required: true, default: 0 },
    totalFinalAmount: { type: Number, required: true, default: 0 },
    notes: { type: String },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
  },
  { timestamps: true }
);

// Keep denormalized totals correct on every save.
TransactionSchema.pre('save', function (next) {
  const doc = this as unknown as ITransaction;
  doc.totalQty = doc.items.reduce((sum, it) => sum + it.qty, 0);
  doc.totalNormalAmount = doc.items.reduce(
    (sum, it) => sum + it.normalPrice * it.qty,
    0
  );
  doc.totalPromoValue = doc.items.reduce((sum, it) => sum + it.promoValue, 0);
  doc.totalFinalAmount = doc.items.reduce((sum, it) => sum + it.finalPrice, 0);
  next();
});

TransactionSchema.index({ date: -1, counterId: 1 });
TransactionSchema.index({ saleByUserId: 1, date: -1 });
TransactionSchema.index({ 'items.productId': 1 });

const Transaction: Model<ITransaction> =
  models.Transaction || model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;
