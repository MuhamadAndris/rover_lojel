import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertPermission } from '@/lib/rbac';
import { parseSpreadsheetFile } from '@/lib/spreadsheetParser';
import { importProductRows } from '@/lib/importProducts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { assertPermission(session.user.role, 'product:manage'); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseSpreadsheetFile(buffer, file.name);
    if (rows.length === 0) return NextResponse.json({ error: 'File kosong atau tidak ada baris data' }, { status: 400 });
    const result = await importProductRows(rows, session.user.userId);
    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal memproses file' }, { status: 500 });
  }
}
