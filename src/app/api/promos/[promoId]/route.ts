import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Promo } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { z } from 'zod';

const updateSchema = z.object({
  promoDescription: z.string().min(1).optional(),
  promoValue: z.number().nonnegative().optional(),
  normalPrice: z.number().nonnegative().optional(),
  finalPrice: z.number().nonnegative().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

interface Params { params: { promoId: string }; }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const promo = await Promo.findOne({ promoId: params.promoId }).lean();
  if (!promo) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: promo });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'promo:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal' }, { status: 400 });

  const promo = await Promo.findOne({ promoId: params.promoId });
  if (!promo) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });

  // Snapshot sebelum perubahan
  const snapshot = {
    promoDescription: promo.promoDescription,
    promoValue: promo.promoValue,
    normalPrice: promo.normalPrice,
    finalPrice: promo.finalPrice,
    startDate: promo.startDate,
    endDate: promo.endDate,
  };

  Object.assign(promo, parsed.data, { updatedBy: session.user.userId });
  promo.history.push({ action: 'updated', changedBy: session.user.userId, changedAt: new Date(), snapshot });
  await promo.save();

  return NextResponse.json({ data: promo });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'promo:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const promo = await Promo.findOne({ promoId: params.promoId });
  if (!promo) return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });

  const snapshot = promo.toObject();
  promo.isDeleted = true;
  promo.updatedBy = session.user.userId;
  promo.history.push({ action: 'deleted', changedBy: session.user.userId, changedAt: new Date(), snapshot });
  await promo.save();

  return NextResponse.json({ success: true });
}
