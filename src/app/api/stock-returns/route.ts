import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { StockReturn } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { applyReturnStock } from '@/lib/stockService';
import { getNextReturnId } from '@/lib/idGenerator';
import { generateItemId } from '@/lib/utils';
import { z } from 'zod';

const itemSchema = z.object({
  productId: z.string().regex(/^\d{9}$/),
  productDescription: z.string().min(1),
  qty: z.number().int().positive(),
  reason: z.string().optional(),
});

const createSchema = z.object({
  date: z.coerce.date(),
  counterId: z.string().regex(/^[A-Za-z0-9]{3}$/),
  supplierName: z.string().optional(),
  deliveryNoteNumber: z.string().optional(),
  deliveryNotePhoto: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const search = searchParams.get('search');
  const counterId = searchParams.get('counterId');

  const filter: Record<string, unknown> = {};
  if (counterId) filter.counterId = counterId;
  if (search) {
    filter.$or = [
      { returnId: { $regex: search, $options: 'i' } },
      { deliveryNoteNumber: { $regex: search, $options: 'i' } },
      { supplierName: { $regex: search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    StockReturn.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StockReturn.countDocuments(filter),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'stock:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const returnId = await getNextReturnId(payload.date);

  try {
    const doc = await StockReturn.create({
      returnId,
      date: payload.date,
      counterId: payload.counterId,
      supplierName: payload.supplierName,
      deliveryNoteNumber: payload.deliveryNoteNumber,
      deliveryNotePhoto: payload.deliveryNotePhoto ?? null,
      items: payload.items.map((it) => ({ ...it, itemId: generateItemId() })),
      status: 'sent',
      createdBy: session.user.userId,
      updatedBy: session.user.userId,
      notes: payload.notes,
      source: 'manual',
    });

    await applyReturnStock({
      returnId: doc.returnId,
      date: doc.date,
      counterId: doc.counterId,
      items: doc.items.map((it) => ({ productId: it.productId, productDescription: it.productDescription, qty: it.qty })),
      createdBy: session.user.userId,
      deliveryNoteNumber: doc.deliveryNoteNumber,
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
