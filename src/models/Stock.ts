import { Schema, model, models, Document, Model } from 'mongoose';

/**
 * Stock holds the CURRENT balance per product per counter.
 * It is maintained automatically by the stock ledger service whenever:
 *  - a StockIncoming is received      -> qty +
 *  - a StockReturn is sent            -> qty -
 *  - a Transaction is set to success  -> qty -
 *  - a Transaction is cancelled/exchanged -> qty + (reverses the sale)
 */
export interface IStock extends Document {
  productId: string;
  productDescription: string;
  counterId: string;
  qtyOnHand: number;
  lastMovementAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    productId: { type: String, required: true, match: /^\d{9}$/ },
    productDescription: { type: String, required: true },
    counterId: {
      type: String,
      required: true,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
    },
    qtyOnHand: { type: Number, required: true, default: 0 },
    lastMovementAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StockSchema.index({ productId: 1, counterId: 1 }, { unique: true });

const Stock: Model<IStock> = models.Stock || model<IStock>('Stock', StockSchema);

export default Stock;
