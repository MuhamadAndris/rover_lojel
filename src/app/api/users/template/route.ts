import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HEADERS = ['user_id', 'name', 'role', 'password', 'counter_id', 'status'];
const SAMPLE_ROWS = [
  ['2212099', 'Andi Saputra', 'sa', 'andi12345', '0E1', 'active'],
  ['2405099', 'Maya Putri', 'spv', 'maya12345', '0E1', 'active'],
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
      'Content-Disposition': 'attachment; filename="template_import_pengguna.csv"',
    },
  });
}
