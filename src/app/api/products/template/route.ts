import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HEADERS = ['product_id', 'brand', 'name', 'color', 'size', 'status'];
const SAMPLE_ROWS = [
  ['901222050', 'NIKE', 'AIR MAX 270', 'BLACK', '42', 'active'],
  ['071253123', 'ADIDAS', 'ULTRABOOST 22', 'WHITE', '40', 'active'],
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
      'Content-Disposition': 'attachment; filename="template_import_produk.csv"',
    },
  });
}
