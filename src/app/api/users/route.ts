import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { assertPermission } from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const createSchema = z.object({
  userId: z.string().regex(/^\d{7}$/, 'User ID harus 7 digit angka'),
  name: z.string().min(1),
  role: z.enum(['super_admin', 'admin_post', 'spv', 'sa']),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  counterId: z.string().regex(/^[A-Za-z0-9]{3}$/).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'user:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const q = searchParams.get('q') || '';

  const filter: Record<string, unknown> = {};
  if (q) filter.$or = [{ userId: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } }];

  const [data, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'user:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const user = await User.create({
      userId: parsed.data.userId,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
      counterId: parsed.data.counterId,
      status: parsed.data.status,
    });
    const obj = user.toObject();
    delete (obj as Record<string, unknown>).passwordHash;
    return NextResponse.json({ data: obj }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal';
    if (msg.includes('duplicate key')) return NextResponse.json({ error: 'User ID sudah digunakan' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
