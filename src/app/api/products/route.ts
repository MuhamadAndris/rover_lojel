import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Product } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { z } from 'zod';

const productSchema = z.object({
  productId: z.string().regex(/^\d{9}$/, 'Product ID harus 9 digit angka'),
  brand: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  status: z.enum(['active', 'inactive', 'discontinued']).default('active'),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const q = searchParams.get('q') || '';
  const status = searchParams.get('status');
  const brand = searchParams.get('brand');

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (brand) filter.brand = { $regex: brand, $options: 'i' };
  if (q) {
    filter.$or = [
      { productId: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
      { color: { $regex: q, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Product.find(filter).sort({ brand: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'product:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  try {
    const product = await Product.create({
      ...parsed.data,
      createdBy: session.user.userId,
      updatedBy: session.user.userId,
    });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal';
    if (msg.includes('duplicate key')) return NextResponse.json({ error: 'Product ID sudah ada' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
