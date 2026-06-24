import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { assertPermission } from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['super_admin', 'admin_post', 'spv', 'sa']).optional(),
  password: z.string().min(6).optional(),
  counterId: z.string().regex(/^[A-Za-z0-9]{3}$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

interface Params { params: { userId: string }; }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'user:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validasi gagal', details: parsed.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    delete updateData.password;
  }

  const user = await User.findOneAndUpdate({ userId: params.userId }, updateData, { new: true }).select('-passwordHash');
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: user });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'user:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  await connectDB();
  const user = await User.findOneAndUpdate({ userId: params.userId }, { status: 'inactive' }, { new: true }).select('-passwordHash');
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ data: user });
}
