import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HEADERS = [
  'return_id', 'date', 'counter_id', 'supplier_name', 'delivery_note_number',
  'product_id', 'product_description', 'qty', 'reason', 'notes',
];
const SAMPLE_ROWS = [
  ['RTN-20260618-0001', '2026-06-18', '0E1', 'PT Sumber Sejahtera', 'SJR-0001', '901222050', 'NIKE AIR MAX 270 BLACK 42', '1', 'cacat produksi', ''],
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
      'Content-Disposition': 'attachment; filename="template_import_return_barang.csv"',
    },
  });
}
