import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction, SalesTarget } from '@/models';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const counterId = searchParams.get('counterId');
  const yearA = parseInt(searchParams.get('yearA') || String(new Date().getFullYear()));
  const yearB = parseInt(searchParams.get('yearB') || '0');
  const saleByUserId = searchParams.get('saleByUserId');

  function buildFilter(year: number) {
    const f: Record<string, unknown> = {
      status: 'success',
      date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59`) },
    };
    if (counterId) f.counterId = counterId;
    if (saleByUserId) f.saleByUserId = saleByUserId;
    if (session.user.role === 'sa') f.saleByUserId = session.user.userId;
    return f;
  }

  async function getMonthlyData(year: number) {
    return Transaction.aggregate([
      { $match: buildFilter(year) },
      {
        $group: {
          _id: { $month: '$date' },
          omset: { $sum: '$totalFinalAmount' },
          transaksi: { $sum: 1 },
          item: { $sum: '$totalQty' },
          diskon: { $sum: '$totalPromoValue' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  const [dataA, dataB, targets] = await Promise.all([
    getMonthlyData(yearA),
    yearB ? getMonthlyData(yearB) : Promise.resolve([]),
    SalesTarget.find(
      counterId
        ? { counterId, period: { $regex: `^${yearA}` } }
        : { period: { $regex: `^${yearA}` } }
    ).lean(),
  ]);

  function toMonthly(raw: { _id: number; omset: number; transaksi: number; item: number; diskon: number }[]) {
    return Array.from({ length: 12 }, (_, i) => {
      const found = raw.find((r) => r._id === i + 1);
      return {
        month: i + 1,
        omset: found?.omset ?? 0,
        transaksi: found?.transaksi ?? 0,
        item: found?.item ?? 0,
        diskon: found?.diskon ?? 0,
      };
    });
  }

  const targetByMonth = new Map(
    targets.map((t) => [parseInt(t.period.split('-')[1]), t.storeTargetAmount])
  );

  const monthlyA = toMonthly(dataA).map((m) => ({
    ...m,
    target: targetByMonth.get(m.month) ?? 0,
  }));

  return NextResponse.json({
    yearA,
    yearB: yearB || null,
    monthlyA,
    monthlyB: yearB ? toMonthly(dataB) : [],
    totalA: monthlyA.reduce((s, m) => s + m.omset, 0),
    totalB: yearB ? toMonthly(dataB).reduce((s, m) => s + m.omset, 0) : 0,
  });
}
