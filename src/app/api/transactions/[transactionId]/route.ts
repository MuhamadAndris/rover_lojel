import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction } from '@/models';
import { assertPermission } from '@/lib/rbac';
import { createTransactionSchema } from '@/lib/validators/transaction';
import { generateItemId } from '@/lib/utils';

interface Params {
  params: { transactionId: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  const txn = await Transaction.findOne({ transactionId: params.transactionId }).lean();
  if (!txn) {
    return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
  }

  if (session.user.role === 'sa' && txn.saleByUserId !== session.user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ data: txn });
}

export async function PUT(req: NextRequest, { params }: Params) {
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
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validasi gagal', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const txn = await Transaction.findOne({ transactionId: params.transactionId });
  if (!txn) {
    return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
  }

  // NOTE: editing items directly does not auto-correct stock. Only status
  // transitions (via PATCH /status) trigger stock movements, to avoid
  // ambiguous double-counting. If items are edited after a sale was already
  // deducted, an admin should reconcile stock manually via an adjustment.
  const payload = parsed.data;
  txn.date = payload.date;
  txn.counterId = payload.counterId;
  txn.bonNumber = payload.bonNumber;
  txn.items = payload.items.map((it) => ({
    ...it,
    itemId: it.itemId || generateItemId(),
    promoDescription: it.promoDescription ?? null,
  }));
  txn.saleByUserId = payload.saleByUserId;
  txn.postByUserId = payload.postByUserId;
  txn.spvId = payload.spvId;
  txn.notes = payload.notes;
  // status changes go through the dedicated endpoint so stock stays correct
  await txn.save();

  return NextResponse.json({ data: txn });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertPermission(session.user.role, 'transaction:delete');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await connectDB();

  const txn = await Transaction.findOne({ transactionId: params.transactionId });
  if (!txn) {
    return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
  }

  if (txn.status === 'success') {
    return NextResponse.json(
      {
        error:
          'Transaksi dengan status "success" tidak bisa dihapus langsung. Ubah status menjadi "cancel" terlebih dahulu agar stok dikembalikan.',
      },
      { status: 400 }
    );
  }

  await Transaction.deleteOne({ transactionId: params.transactionId });
  return NextResponse.json({ success: true });
}
