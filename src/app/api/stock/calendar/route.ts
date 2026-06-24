import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { StockLedger, Product } from '@/models';

export interface DayCell {
  in: number;
  out: number;
  returnQty: number; // portion of `out` that came from a return (the "R" count)
  notes: string[]; // delivery note numbers / bon numbers touching this day
}

export interface CalendarRow {
  productId: string;
  brand: string;
  name: string;
  color: string;
  size: string;
  startQty: number; // balance at the beginning of the period (before day 1)
  days: Record<number, DayCell>; // keyed by day-of-month (1-31)
  endingStock: number; // balance at the end of the period (or "now" if period is current month)
}

/**
 * Builds the calendar-style stock book ("buku stok") for one month:
 * one row per product, one column per day, showing IN qty, OUT qty
 * (sales + returns combined, with the return portion tagged separately
 * so the UI can render "2 - R1"), and a running start/ending balance.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1)); // 1-12
  const counterId = searchParams.get('counterId') || '';
  const search = searchParams.get('search') || ''; // by product name/brand/id

  if (!counterId) {
    return NextResponse.json({ error: 'counterId wajib diisi' }, { status: 400 });
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999); // last day of month
  const daysInMonth = periodEnd.getDate();

  // 1. Resolve which products to show (filtered by search, scoped to this counter's ledger)
  const productFilter: Record<string, unknown> = { status: { $ne: 'discontinued' } };
  if (search) {
    productFilter.$or = [
      { productId: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }
  const products = await Product.find(productFilter).sort({ brand: 1, name: 1, size: 1 }).lean();

  if (products.length === 0) {
    return NextResponse.json({ data: [], daysInMonth, year, month });
  }

  const productIds = products.map((p) => p.productId);

  // 2. Starting balance = sum of all movements BEFORE periodStart
  const startAgg = await StockLedger.aggregate([
    {
      $match: {
        counterId,
        productId: { $in: productIds },
        date: { $lt: periodStart },
      },
    },
    {
      $group: {
        _id: '$productId',
        startQty: { $sum: { $subtract: ['$qtyIn', '$qtyOut'] } },
      },
    },
  ]);
  const startByProduct = new Map(startAgg.map((s) => [s._id, s.startQty]));

  // 3. All movements WITHIN the period, to build daily cells
  const periodMovements = await StockLedger.find({
    counterId,
    productId: { $in: productIds },
    date: { $gte: periodStart, $lte: periodEnd },
  })
    .sort({ date: 1 })
    .lean();

  // 4. Assemble rows
  const rows: CalendarRow[] = products.map((p) => {
    const startQty = startByProduct.get(p.productId) ?? 0;
    const days: Record<number, DayCell> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      days[d] = { in: 0, out: 0, returnQty: 0, notes: [] };
    }

    let running = startQty;
    const movementsForProduct = periodMovements.filter((m) => m.productId === p.productId);

    for (const m of movementsForProduct) {
      const day = new Date(m.date).getDate();
      const cell = days[day];
      if (m.qtyIn > 0) {
        cell.in += m.qtyIn;
        running += m.qtyIn;
      }
      if (m.qtyOut > 0) {
        cell.out += m.qtyOut;
        if (m.movementType === 'return_out') {
          cell.returnQty += m.qtyOut;
        }
        running -= m.qtyOut;
      }
      if (m.deliveryNoteNumber && !cell.notes.includes(m.deliveryNoteNumber)) {
        cell.notes.push(m.deliveryNoteNumber);
      }
    }

    return {
      productId: p.productId,
      brand: p.brand,
      name: p.name,
      color: p.color,
      size: p.size,
      startQty,
      days,
      endingStock: running,
    };
  });

  return NextResponse.json({ data: rows, daysInMonth, year, month, counterId });
}
