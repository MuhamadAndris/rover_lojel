import { Schema, model, models, Document, Model } from 'mongoose';

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export interface IProduct extends Document {
  productId: string; // 9-digit string e.g. "901222050"
  brand: string;
  name: string;
  color: string;
  size: string;
  status: ProductStatus;
  createdBy: string; // userId (7 digit)
  updatedBy: string; // userId (7 digit)
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{9}$/, 'Product ID must be exactly 9 digits'],
      index: true,
    },
    brand: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },
    createdBy: { type: String, required: true, match: /^\d{7}$/ },
    updatedBy: { type: String, required: true, match: /^\d{7}$/ },
  },
  { timestamps: true }
);

// Virtual: full description, mirrors the "product description" concatenation
// used across transactions: brand + name + size + color
ProductSchema.virtual('description').get(function (this: IProduct) {
  return `${this.brand} ${this.name} ${this.size} ${this.color}`.trim();
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

ProductSchema.index({ brand: 1, name: 1 });

const Product: Model<IProduct> =
  models.Product || model<IProduct>('Product', ProductSchema);

export default Product;
