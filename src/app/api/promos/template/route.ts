import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HEADERS = [
  'promo_id', 'product_id', 'product_description', 'promo_description',
  'normal_price', 'promo_value', 'final_price', 'start_date', 'end_date',
];
const SAMPLE_ROWS = [
  ['PRM-0001', '901222050', 'NIKE AIR MAX 270 BLACK 42', '10%', '1200000', '120000', '1080000', '2026-06-01', ''],
  ['PRM-0002', '071253123', 'ADIDAS ULTRABOOST 22 WHITE 40', '20+10%', '1500000', '660000', '840000', '2026-06-01', '2026-06-30'],
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lines = [HEADERS.join(',')];
  for (const row of SAMPLE_ROWS) lines.push(row.join(','));
  const csv = lines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template_import_promo.csv"',
    },
  });
}
