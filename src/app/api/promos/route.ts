import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Promo } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { z } from 'zod';

const promoSchema = z.object({
  promoId: z.string().min(1),
  productId: z.string().regex(/^\d{9}$/),
  productDescription: z.string().min(1),
  promoDescription: z.string().min(1),
  promoValue: z.number().nonnegative(),
  normalPrice: z.number().nonnegative(),
  finalPrice: z.number().nonnegative(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const q = searchParams.get('q') || '';
  const productId = searchParams.get('productId');
  const isActive = searchParams.get('active'); // 'true'/'false'

  const filter: Record<string, unknown> = { isDeleted: false };
  if (productId) filter.productId = productId;
  if (q) {
    filter.$or = [
      { promoId: { $regex: q, $options: 'i' } },
      { productId: { $regex: q, $options: 'i' } },
      { productDescription: { $regex: q, $options: 'i' } },
      { promoDescription: { $regex: q, $options: 'i' } },
    ];
  }

  const now = new Date();
  if (isActive === 'true') {
    filter.startDate = { $lte: now };
    filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
  } else if (isActive === 'false') {
    filter.$or = [{ endDate: { $lt: now } }, { startDate: { $gt: now } }];
  }

  const [data, total] = await Promise.all([
    Promo.find(filter).sort({ startDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Promo.countDocuments(filter),
  ]);

  // Annotate with derived status
  const now2 = new Date();
  const annotated = data.map((p) => ({
    ...p,
    derivedStatus:
      p.startDate > now2
        ? 'upcoming'
        : p.endDate && p.endDate < now2
        ? 'expired'
        : 'active',
  }));

  return NextResponse.json({ data: annotated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'promo:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = promoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  try {
    const promo = await Promo.create({
      ...parsed.data,
      startDate: parsed.data.startDate ?? new Date(),
      endDate: parsed.data.endDate ?? null,
      createdBy: session.user.userId,
      updatedBy: session.user.userId,
      history: [{ action: 'created', changedBy: session.user.userId, changedAt: new Date(), snapshot: {} }],
    });
    return NextResponse.json({ data: promo }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal';
    if (msg.includes('duplicate key')) return NextResponse.json({ error: 'Promo ID sudah ada' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
