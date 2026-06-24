import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const TEMPLATE_HEADERS = [
  'transaction_id',
  'date',
  'counter_id',
  'bon_number',
  'product_id',
  'product_description',
  'qty',
  'normal_price',
  'promo_description',
  'promo_value',
  'final_price',
  'sale_by_user_id',
  'post_by_user_id',
  'spv_id',
  'status',
  'notes',
];

const SAMPLE_ROWS = [
  [
    'TRX-20260618-0001',
    '2026-06-18',
    '0E1',
    'BON0001',
    '901222050',
    'NIKE AIR MAX 42 BLACK',
    '1',
    '1200000',
    '10%',
    '120000',
    '1080000',
    '2212010',
    '2212010',
    '2405004',
    'success',
    '',
  ],
  [
    'TRX-20260618-0001',
    '2026-06-18',
    '0E1',
    'BON0001',
    '071253123',
    'ADIDAS ULTRABOOST 40 WHITE',
    '2',
    '1500000',
    '20+10%',
    '660000',
    '2340000',
    '2212010',
    '2212010',
    '2405004',
    'success',
    'satu transaksi, dua item produk',
  ],
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lines = [TEMPLATE_HEADERS.join(',')];
  for (const row of SAMPLE_ROWS) {
    lines.push(row.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
  }
  const csv = lines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template_import_transaksi.csv"',
    },
  });
}
