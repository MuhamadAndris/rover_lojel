import { Schema, model, models, Document, Model } from 'mongoose';

export type UserRole = 'super_admin' | 'admin_post' | 'spv' | 'sa';

export interface IUser extends Document {
  userId: string; // 7-digit string, e.g. "2212010" — also used as login username
  name: string;
  role: UserRole;
  passwordHash: string;
  counterId?: string; // optional "home counter" for SA/SPV, e.g. "0E1"
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{7}$/, 'User ID must be exactly 7 digits'],
      index: true,
    },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['super_admin', 'admin_post', 'spv', 'sa'],
      required: true,
    },
    passwordHash: { type: String, required: true },
    counterId: {
      type: String,
      match: [/^[A-Za-z0-9]{3}$/, 'Counter ID must be exactly 3 characters'],
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

const User: Model<IUser> = models.User || model<IUser>('User', UserSchema);

export default User;
