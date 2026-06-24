import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { StockLedger } from '@/models';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

const MOVEMENT_LABELS: Record<string, string> = {
  incoming: 'Barang Datang',
  return_out: 'Return Supplier',
  sale: 'Penjualan',
  sale_reversal: 'Pembalikan Jual',
  adjustment: 'Penyesuaian',
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');
  const counterId = searchParams.get('counterId');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const filter: Record<string, unknown> = {};
  if (productId) filter.productId = productId;
  if (counterId) filter.counterId = counterId;
  if (dateFrom || dateTo) {
    const d: Record<string, Date> = {};
    if (dateFrom) d.$gte = new Date(dateFrom);
    if (dateTo) d.$lte = new Date(dateTo);
    filter.date = d;
  }
  if (session.user.role === 'sa' && session.user.counterId) {
    filter.counterId = session.user.counterId;
  }

  const rows = await StockLedger.find(filter).sort({ date: 1, createdAt: 1 }).lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Retail POS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Buku Stok', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  // Header styling
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C7C71' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };

  sheet.columns = [
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Counter', key: 'counterId', width: 10 },
    { header: 'Product ID', key: 'productId', width: 14 },
    { header: 'Deskripsi Produk', key: 'productDescription', width: 36 },
    { header: 'Jenis Mutasi', key: 'movementType', width: 18 },
    { header: 'Masuk', key: 'qtyIn', width: 10 },
    { header: 'Keluar', key: 'qtyOut', width: 10 },
    { header: 'Saldo', key: 'balanceAfter', width: 10 },
    { header: 'Referensi', key: 'referenceType', width: 14 },
    { header: 'ID Referensi', key: 'referenceId', width: 22 },
    { header: 'Catatan', key: 'notes', width: 28 },
    { header: 'Dibuat oleh', key: 'createdBy', width: 12 },
  ];

  // Apply header styling
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF249688' } } };
  });
  headerRow.height = 22;

  // Data rows
  rows.forEach((r, idx) => {
    const row = sheet.addRow({
      date: new Date(r.date).toLocaleDateString('id-ID'),
      counterId: r.counterId,
      productId: r.productId,
      productDescription: r.productDescription,
      movementType: MOVEMENT_LABELS[r.movementType] ?? r.movementType,
      qtyIn: r.qtyIn || '',
      qtyOut: r.qtyOut || '',
      balanceAfter: r.balanceAfter,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      notes: r.notes ?? '',
      createdBy: r.createdBy,
    });

    // Alternate row bg
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6F8' } };
      });
    }

    // Color qtyIn / qtyOut / balance
    const inCell = row.getCell('qtyIn');
    const outCell = row.getCell('qtyOut');
    const balCell = row.getCell('balanceAfter');

    if (r.qtyIn > 0) inCell.font = { color: { argb: 'FF1C7C71' }, bold: true };
    if (r.qtyOut > 0) outCell.font = { color: { argb: 'FFCC4757' }, bold: true };
    balCell.font = { bold: true };
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `buku-stok-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
