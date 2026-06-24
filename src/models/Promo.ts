import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IPromoHistoryEntry {
  action: 'created' | 'updated' | 'deleted';
  changedBy: string; // userId
  changedAt: Date;
  snapshot: Record<string, unknown>; // values before this change (for 'updated'/'deleted')
}

export interface IPromo extends Document {
  promoId: string;
  startDate: Date; // defaults to now on creation
  endDate: Date | null; // null = no end date yet (ongoing/open-ended)
  productId: string;
  productDescription: string;
  promoDescription: string; // e.g. "10%", "20+10%", "SPECIAL PRICE", "BUY 1 GET 1"
  promoValue: number; // discount amount
  normalPrice: number;
  finalPrice: number;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean; // soft delete, so "ever changed/deleted" can be inspected
  history: IPromoHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const PromoHistorySchema = new Schema<IPromoHistoryEntry>(
  {
    action: { type: String, enum: ['created', 'updated', 'deleted'], required: true },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    snapshot: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const PromoSchema = new Schema<IPromo>(
  {
    promoId: { type: String, required: true, unique: true, index: true },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, default: null },
    productId: { type: String, required: true, match: /^\d{9}$/, index: true },
    productDescription: { type: String, required: true },
    promoDescription: { type: String, required: true },
    promoValue: { type: Number, required: true, min: 0 },
    normalPrice: { type: Number, required: true, min: 0 },
    finalPrice: { type: Number, required: true, min: 0 },
    createdBy: { type: String, required: true, match: /^\d{7}$/ },
    updatedBy: { type: String, required: true, match: /^\d{7}$/ },
    isDeleted: { type: Boolean, default: false },
    history: { type: [PromoHistorySchema], default: [] },
  },
  { timestamps: true }
);

// NOTE: "promo status" (upcoming / active / expired) is intentionally NOT
// stored as a field. It must be derived at query/render time by comparing
// startDate/endDate against "now":
//   - active:   startDate <= now && (endDate === null || endDate >= now)
//   - upcoming: startDate > now
//   - expired:  endDate !== null && endDate < now

PromoSchema.index({ productId: 1, startDate: -1 });

const Promo: Model<IPromo> = models.Promo || model<IPromo>('Promo', PromoSchema);

export default Promo;
