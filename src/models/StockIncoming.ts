import { Schema, model, models, Document, Model } from 'mongoose';

export interface IStockIncomingItem {
  itemId: string;
  productId: string;
  productDescription: string;
  qty: number;
}

export interface IStockIncoming extends Document {
  incomingId: string; // e.g. "IN-20260618-0001"
  date: Date;
  counterId: string;
  supplierName?: string;
  deliveryNoteNumber?: string; // nomor surat jalan
  deliveryNotePhoto?: string | null; // file path / url to uploaded photo
  items: IStockIncomingItem[];
  totalQty: number;
  status: 'pending' | 'received' | 'cancelled';
  createdBy: string;
  updatedBy: string;
  source: 'manual' | 'import';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockIncomingItemSchema = new Schema<IStockIncomingItem>(
  {
    itemId: { type: String, required: true },
    productId: { type: String, required: true, match: /^\d{9}$/ },
    productDescription: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const StockIncomingSchema = new Schema<IStockIncoming>(
  {
    incomingId: { type: String, required: true, unique: true, index: true },
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
      type: [StockIncomingItemSchema],
      required: true,
      validate: {
        validator: (v: IStockIncomingItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Incoming stock record must have at least one item',
      },
    },
    totalQty: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'received', 'cancelled'],
      default: 'received',
    },
    createdBy: { type: String, required: true, match: /^\d{7}$/ },
    updatedBy: { type: String, required: true, match: /^\d{7}$/ },
    source: { type: String, enum: ['manual', 'import'], default: 'manual' },
    notes: { type: String },
  },
  { timestamps: true }
);

StockIncomingSchema.pre('save', function (next) {
  const doc = this as unknown as IStockIncoming;
  doc.totalQty = doc.items.reduce((sum, it) => sum + it.qty, 0);
  next();
});

StockIncomingSchema.index({ 'items.productId': 1 });

const StockIncoming: Model<IStockIncoming> =
  models.StockIncoming ||
  model<IStockIncoming>('StockIncoming', StockIncomingSchema);

export default StockIncoming;
