import { Schema, model, models, Document, Model } from 'mongoose';

/**
 * One document per month per counter, optionally broken down per SA.
 * Store target as a whole number (currency unit), e.g. rupiah.
 */
export interface ISalesTargetBreakdown {
  saId: string; // 7-digit SA user id
  targetAmount: number;
}

export interface ISalesTarget extends Document {
  period: string; // "YYYY-MM", e.g. "2026-06"
  counterId: string;
  storeTargetAmount: number;
  saTargets: ISalesTargetBreakdown[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTargetBreakdownSchema = new Schema<ISalesTargetBreakdown>(
  {
    saId: { type: String, required: true, match: /^\d{7}$/ },
    targetAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SalesTargetSchema = new Schema<ISalesTarget>(
  {
    period: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format'],
    },
    counterId: {
      type: String,
      required: true,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
    },
    storeTargetAmount: { type: Number, required: true, min: 0 },
    saTargets: { type: [SalesTargetBreakdownSchema], default: [] },
    createdBy: { type: String, required: true, match: /^\d{7}$/ },
    updatedBy: { type: String, required: true, match: /^\d{7}$/ },
  },
  { timestamps: true }
);

SalesTargetSchema.index({ period: 1, counterId: 1 }, { unique: true });

const SalesTarget: Model<ISalesTarget> =
  models.SalesTarget || model<ISalesTarget>('SalesTarget', SalesTargetSchema);

export default SalesTarget;
