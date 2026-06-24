import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Product } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { z } from 'zod';

const updateSchema = z.object({
  brand: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
});

interface Params { params: { productId: string }; }

export async function GET(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const product = await Product.findOne({ productId: params.productId }).lean();
  if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: product });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'product:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  const product = await Product.findOneAndUpdate(
    { productId: params.productId },
    { ...parsed.data, updatedBy: session.user.userId },
    { new: true }
  );
  if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: product });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'product:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const product = await Product.findOneAndUpdate(
    { productId: params.productId },
    { status: 'discontinued', updatedBy: session.user.userId },
    { new: true }
  );
  if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: product });
}
