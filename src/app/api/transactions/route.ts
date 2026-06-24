import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction } from '@/models';
import { createTransactionSchema } from '@/lib/validators/transaction';
import { createTransaction } from '@/lib/transactionService';
import { getNextTransactionId } from '@/lib/idGenerator';
import { assertPermission } from '@/lib/rbac';
import { generateItemId } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const status = searchParams.get('status');
  const counterId = searchParams.get('counterId');
  const saleByUserId = searchParams.get('saleByUserId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const search = searchParams.get('search'); // matches transactionId, bonNumber, productId

  const filter: Record<string, unknown> = {};

  // SA can only see their own transactions; SPV/admin/super_admin see all
  if (session.user.role === 'sa') {
    filter.saleByUserId = session.user.userId;
  } else if (saleByUserId) {
    filter.saleByUserId = saleByUserId;
  }

  if (status) filter.status = status;
  if (counterId) filter.counterId = counterId;

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    filter.date = dateFilter;
  }

  if (search) {
    filter.$or = [
      { transactionId: { $regex: search, $options: 'i' } },
      { bonNumber: { $regex: search, $options: 'i' } },
      { 'items.productId': { $regex: search, $options: 'i' } },
      { 'items.productDescription': { $regex: search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertPermission(session.user.role, 'transaction:create');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const body = await req.json();
  const parsed = createTransactionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const transactionId = payload.transactionId || (await getNextTransactionId(payload.date));

  // SA role: force saleByUserId to be themselves
  const saleByUserId =
    session.user.role === 'sa' ? session.user.userId : payload.saleByUserId;

  try {
    const txn = await createTransaction({
      transactionId,
      date: payload.date,
      counterId: payload.counterId,
      bonNumber: payload.bonNumber,
      items: payload.items.map((it) => ({
        ...it,
        itemId: it.itemId || generateItemId(),
        promoDescription: it.promoDescription ?? null,
      })),
      saleByUserId,
      postByUserId: payload.postByUserId,
      spvId: payload.spvId,
      status: payload.status,
      notes: payload.notes,
      source: 'manual',
    });

    return NextResponse.json({ data: txn }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat transaksi';
    if (message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Transaction ID sudah digunakan' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
