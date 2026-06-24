import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role'); // optional filter: sa | spv | admin_post | super_admin
  const q = searchParams.get('q') || '';

  const filter: Record<string, unknown> = { status: 'active' };
  if (role) filter.role = role;
  if (q) {
    filter.$or = [
      { userId: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
    ];
  }

  const users = await User.find(filter)
    .select('userId name role counterId')
    .limit(50)
    .lean();

  return NextResponse.json({ data: users });
}
