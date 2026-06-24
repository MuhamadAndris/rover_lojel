import { z } from 'zod';

export const transactionItemSchema = z.object({
  itemId: z.string().optional(),
  productId: z.string().regex(/^\d{9}$/, 'Product ID harus 9 digit angka'),
  productDescription: z.string().min(1, 'Deskripsi produk wajib diisi'),
  qty: z.number().int().positive('Qty harus lebih dari 0'),
  normalPrice: z.number().nonnegative('Harga normal tidak boleh negatif'),
  promoDescription: z.string().nullable().optional(),
  promoValue: z.number().nonnegative('Nilai promo tidak boleh negatif').default(0),
  finalPrice: z.number().nonnegative('Harga akhir tidak boleh negatif'),
});

export const createTransactionSchema = z.object({
  transactionId: z.string().optional(), // auto-generated if omitted
  date: z.coerce.date(),
  counterId: z
    .string()
    .regex(/^[A-Za-z0-9]{3}$/, 'Counter ID harus 3 karakter'),
  bonNumber: z.string().min(1, 'Nomor bon wajib diisi'),
  items: z.array(transactionItemSchema).min(1, 'Minimal 1 item produk'),
  saleByUserId: z.string().regex(/^\d{7}$/, 'Sale ID harus 7 digit angka'),
  postByUserId: z.string().regex(/^\d{7}$/, 'Post by ID harus 7 digit angka'),
  spvId: z.string().regex(/^\d{7}$/, 'SPV ID harus 7 digit angka'),
  status: z.enum(['success', 'cancel', 'exchange']).default('success'),
  notes: z.string().optional(),
});

export const updateTransactionStatusSchema = z.object({
  status: z.enum(['success', 'cancel', 'exchange']),
});

export type CreateTransactionPayload = z.infer<typeof createTransactionSchema>;
