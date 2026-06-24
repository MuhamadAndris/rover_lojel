import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertPermission } from '@/lib/rbac';
import {
  parseCsvBuffer,
  parseExcelBuffer,
  importTransactionRows,
} from '@/lib/importTransactions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    assertPermission(session.user.role, 'transaction:import');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name.toLowerCase();

  try {
    let rows;
    if (fileName.endsWith('.csv')) {
      rows = await parseCsvBuffer(buffer);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      rows = await parseExcelBuffer(buffer);
    } else {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'File kosong atau tidak ada baris data yang terbaca' },
        { status: 400 }
      );
    }

    const result = await importTransactionRows(rows, session.user.userId);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
