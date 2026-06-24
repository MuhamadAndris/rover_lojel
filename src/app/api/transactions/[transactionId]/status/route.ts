import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { changeTransactionStatus } from '@/lib/transactionService';
import { updateTransactionStatusSchema } from '@/lib/validators/transaction';
import { assertPermission } from '@/lib/rbac';

interface Params {
  params: { transactionId: string };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertPermission(session.user.role, 'transaction:edit');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const body = await req.json();
  const parsed = updateTransactionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Status tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const txn = await changeTransactionStatus(
      params.transactionId,
      parsed.data.status,
      session.user.userId
    );
    return NextResponse.json({ data: txn });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah status';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
