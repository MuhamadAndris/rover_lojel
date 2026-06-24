import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { StockLedger, Stock } from '@/models';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const productId = searchParams.get('productId');
  const counterId = searchParams.get('counterId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const movementType = searchParams.get('movementType');

  const filter: Record<string, unknown> = {};
  if (productId) filter.productId = productId;
  if (counterId) filter.counterId = counterId;
  if (movementType) filter.movementType = movementType;
  if (dateFrom || dateTo) {
    const d: Record<string, Date> = {};
    if (dateFrom) d.$gte = new Date(dateFrom);
    if (dateTo) d.$lte = new Date(dateTo);
    filter.date = d;
  }

  // For SA: restrict to their counter only
  if (session.user.role === 'sa' && session.user.counterId) {
    filter.counterId = session.user.counterId;
  }

  const [data, total, currentStock] = await Promise.all([
    StockLedger.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StockLedger.countDocuments(filter),
    productId && counterId ? Stock.findOne({ productId, counterId }).lean() : Promise.resolve(null),
  ]);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    currentStock: currentStock?.qtyOnHand ?? null,
  });
}
