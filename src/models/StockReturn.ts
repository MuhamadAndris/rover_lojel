import { Schema, model, models, Document, Model } from 'mongoose';

export interface IStockReturnItem {
  itemId: string;
  productId: string;
  productDescription: string;
  qty: number;
  reason?: string; // e.g. "defect", "wrong size shipped", etc
}

export interface IStockReturn extends Document {
  returnId: string; // e.g. "RTN-20260618-0001"
  date: Date;
  counterId: string;
  supplierName?: string;
  deliveryNoteNumber?: string; // nomor surat jalan retur
  deliveryNotePhoto?: string | null;
  items: IStockReturnItem[];
  totalQty: number;
  status: 'pending' | 'sent' | 'cancelled';
  createdBy: string;
  updatedBy: string;
  source: 'manual' | 'import';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockReturnItemSchema = new Schema<IStockReturnItem>(
  {
    itemId: { type: String, required: true },
    productId: { type: String, required: true, match: /^\d{9}$/ },
    productDescription: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const StockReturnSchema = new Schema<IStockReturn>(
  {
    returnId: { type: String, required: true, unique: true, index: true },
    date: { type: Date, required: true, index: true },
    counterId: {
      type: String,
      required: true,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
      index: true,
    },
    supplierName: { type: String, trim: true },
    deliveryNoteNumber: { type: String, trim: true },
    deliveryNotePhoto: { type: String, default: null },
    items: {
      type: [StockReturnItemSchema],
      required: true,
      validate: {
        validator: (v: IStockReturnItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Return stock record must have at least one item',
      },
    },
    totalQty: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'sent', 'cancelled'],
      default: 'sent',
    },
    createdBy: { type: String, required: true, match: /^\d{7}$/ },
    updatedBy: { type: String, required: true, match: /^\d{7}$/ },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
    notes: { type: String },
  },
  { timestamps: true }
);

StockReturnSchema.pre('save', function (next) {
  const doc = this as unknown as IStockReturn;
  doc.totalQty = doc.items.reduce((sum, it) => sum + it.qty, 0);
  next();
});

StockReturnSchema.index({ 'items.productId': 1 });

const StockReturn: Model<IStockReturn> =
  models.StockReturn || model<IStockReturn>('StockReturn', StockReturnSchema);

export default StockReturn;
