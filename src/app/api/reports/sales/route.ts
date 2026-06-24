import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction } from '@/models';

/**
 * Sales report = flattened transaction items (one row per item, not per
 * transaction) plus aggregate summaries (by product, by SA, by counter).
 * This is what differentiates it from the Transactions page, which lists
 * one row per transaction header for day-to-day operational use.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const counterId = searchParams.get('counterId');
  const saleByUserId = searchParams.get('saleByUserId');
  const status = searchParams.get('status') || 'success';
  const groupBy = searchParams.get('groupBy') || 'none'; // none | product | sa | counter

  const filter: Record<string, unknown> = {};
  if (status !== 'all') filter.status = status;
  if (counterId) filter.counterId = counterId;
  if (saleByUserId) filter.saleByUserId = saleByUserId;
  if (session.user.role === 'sa') filter.saleByUserId = session.user.userId;

  if (dateFrom || dateTo) {
    const d: Record<string, Date> = {};
    if (dateFrom) d.$gte = new Date(dateFrom);
    if (dateTo) d.$lte = new Date(dateTo);
    filter.date = d;
  }

  const transactions = await Transaction.find(filter).sort({ date: -1 }).lean();

  // Flatten to one row per item
  const rows = transactions.flatMap((t) =>
    t.items.map((it) => ({
      transactionId: t.transactionId,
      date: t.date,
      counterId: t.counterId,
      bonNumber: t.bonNumber,
      saleByUserId: t.saleByUserId,
      spvId: t.spvId,
      status: t.status,
      productId: it.productId,
      productDescription: it.productDescription,
      qty: it.qty,
      normalPrice: it.normalPrice,
      promoDescription: it.promoDescription,
      promoValue: it.promoValue,
      finalPrice: it.finalPrice,
    }))
  );

  // Summary aggregates
  const summary = {
    totalTransaksi: transactions.length,
    totalItem: rows.reduce((s, r) => s + r.qty, 0),
    totalOmset: rows.reduce((s, r) => s + r.finalPrice, 0),
    totalDiskon: rows.reduce((s, r) => s + r.promoValue, 0),
    totalNormal: rows.reduce((s, r) => s + r.normalPrice * r.qty, 0),
  };

  let grouped: Record<string, unknown>[] = [];
  if (groupBy === 'product') {
    const map = new Map<string, { productId: string; productDescription: string; qty: number; omset: number; diskon: number }>();
    for (const r of rows) {
      const key = r.productId;
      const existing = map.get(key) ?? { productId: r.productId, productDescription: r.productDescription, qty: 0, omset: 0, diskon: 0 };
      existing.qty += r.qty;
      existing.omset += r.finalPrice;
      existing.diskon += r.promoValue;
      map.set(key, existing);
    }
    grouped = Array.from(map.values()).sort((a, b) => b.omset - a.omset);
  } else if (groupBy === 'sa') {
    const map = new Map<string, { saId: string; qty: number; omset: number; transaksi: Set<string> }>();
    for (const r of rows) {
      const existing = map.get(r.saleByUserId) ?? { saId: r.saleByUserId, qty: 0, omset: 0, transaksi: new Set<string>() };
      existing.qty += r.qty;
      existing.omset += r.finalPrice;
      existing.transaksi.add(r.transactionId);
      map.set(r.saleByUserId, existing);
    }
    grouped = Array.from(map.values())
      .map((v) => ({ saId: v.saId, qty: v.qty, omset: v.omset, transaksi: v.transaksi.size }))
      .sort((a, b) => b.omset - a.omset);
  } else if (groupBy === 'counter') {
    const map = new Map<string, { counterId: string; qty: number; omset: number; transaksi: Set<string> }>();
    for (const r of rows) {
      const existing = map.get(r.counterId) ?? { counterId: r.counterId, qty: 0, omset: 0, transaksi: new Set<string>() };
      existing.qty += r.qty;
      existing.omset += r.finalPrice;
      existing.transaksi.add(r.transactionId);
      map.set(r.counterId, existing);
    }
    grouped = Array.from(map.values())
      .map((v) => ({ counterId: v.counterId, qty: v.qty, omset: v.omset, transaksi: v.transaksi.size }))
      .sort((a, b) => b.omset - a.omset);
  }

  return NextResponse.json({ rows, summary, grouped, groupBy });
}
