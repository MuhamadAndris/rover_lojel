import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HEADERS = [
  'incoming_id', 'date', 'counter_id', 'supplier_name', 'delivery_note_number',
  'product_id', 'product_description', 'qty', 'notes',
];
const SAMPLE_ROWS = [
  ['IN-20260618-0001', '2026-06-18', '0E1', 'PT Sumber Sejahtera', 'SJ-0001', '901222050', 'NIKE AIR MAX 270 BLACK 42', '5', ''],
  ['IN-20260618-0001', '2026-06-18', '0E1', 'PT Sumber Sejahtera', 'SJ-0001', '071253123', 'ADIDAS ULTRABOOST 22 WHITE 40', '3', 'satu surat jalan, dua produk'],
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lines = [HEADERS.join(',')];
  for (const row of SAMPLE_ROWS) {
    lines.push(row.map((v) => (v.includes(',') ? `"${v}"` : v)).join(','));
  }
  const csv = lines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template_import_datang_barang.csv"',
    },
  });
}
