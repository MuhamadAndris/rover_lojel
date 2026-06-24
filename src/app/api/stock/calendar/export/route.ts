import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { StockLedger, Product } from '@/models';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const counterId = searchParams.get('counterId') || '';
  const search = searchParams.get('search') || '';

  if (!counterId) {
    return NextResponse.json({ error: 'counterId wajib diisi' }, { status: 400 });
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const daysInMonth = periodEnd.getDate();

  const productFilter: Record<string, unknown> = { status: { $ne: 'discontinued' } };
  if (search) {
    productFilter.$or = [
      { productId: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }
  const products = await Product.find(productFilter).sort({ brand: 1, name: 1, size: 1 }).lean();
  const productIds = products.map((p) => p.productId);

  const startAgg = await StockLedger.aggregate([
    { $match: { counterId, productId: { $in: productIds }, date: { $lt: periodStart } } },
    { $group: { _id: '$productId', startQty: { $sum: { $subtract: ['$qtyIn', '$qtyOut'] } } } },
  ]);
  const startByProduct = new Map(startAgg.map((s) => [s._id, s.startQty]));

  const periodMovements = await StockLedger.find({
    counterId,
    productId: { $in: productIds },
    date: { $gte: periodStart, $lte: periodEnd },
  }).sort({ date: 1 }).lean();

  // ---------- Build workbook ----------
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Retail POS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Stock Report', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C7C71' } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FFE6E9EF' } };

  // Title row
  const titleColCount = 5 + 1 + daysInMonth + 2; // name,color,size,sku,start + DATE label + days + total + ending
  sheet.mergeCells(1, 1, 1, titleColCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `STOCK REPORT — ${MONTH_NAMES[month - 1]} ${year} — Counter ${counterId}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };
  sheet.getRow(1).height = 24;

  // Header row 1: group "DATE" label spanning all day columns
  const r2 = sheet.getRow(2);
  ['NAME', 'COLOR', 'SIZE', 'SKU', 'START'].forEach((label, i) => {
    const cell = r2.getCell(i + 1);
    cell.value = label;
  });
  sheet.mergeCells(2, 6, 2, 5 + daysInMonth);
  r2.getCell(6).value = 'DATE';
  r2.getCell(6 + daysInMonth).value = ''; // placeholder, merge handles span
  r2.getCell(6 + daysInMonth + 0).value = '';
  const totalColIdx = 6 + daysInMonth;
  const endingColIdx = totalColIdx + 1;
  r2.getCell(totalColIdx).value = 'TOTAL';
  r2.getCell(endingColIdx).value = 'ENDING STOCK';

  r2.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  r2.height = 20;

  // Header row 2: day numbers 1..N under DATE
  const r3 = sheet.getRow(3);
  for (let d = 1; d <= daysInMonth; d++) {
    r3.getCell(5 + d).value = d;
  }
  r3.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = { ...headerFont, size: 9 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  r3.height = 18;

  // Column widths
  sheet.getColumn(1).width = 22; // name
  sheet.getColumn(2).width = 12; // color
  sheet.getColumn(3).width = 8;  // size
  sheet.getColumn(4).width = 14; // sku
  sheet.getColumn(5).width = 8;  // start
  for (let d = 1; d <= daysInMonth; d++) sheet.getColumn(5 + d).width = 7;
  sheet.getColumn(totalColIdx).width = 9;
  sheet.getColumn(endingColIdx).width = 13;

  // Group products by name (to mimic the merged "NAME" cell look in the screenshot)
  let currentRow = 4;
  let lastName: string | null = null;
  let groupStartRow = 4;
  let grandTotal = 0;

  function closeGroupMerge(endRow: number) {
    if (groupStartRow < endRow) {
      try { sheet.mergeCells(groupStartRow, 1, endRow, 1); } catch { /* ignore */ }
    }
  }

  for (const p of products) {
    const startQty = startByProduct.get(p.productId) ?? 0;
    const movementsForProduct = periodMovements.filter((m) => m.productId === p.productId);

    const row = sheet.getRow(currentRow);
    row.getCell(1).value = p.name;
    row.getCell(2).value = p.color;
    row.getCell(3).value = p.size;
    row.getCell(4).value = p.productId;
    row.getCell(5).value = startQty;

    if (lastName !== p.name) {
      closeGroupMerge(currentRow - 1);
      groupStartRow = currentRow;
      lastName = p.name;
    }

    let running = startQty;
    const noteSet = new Set<string>();

    for (let d = 1; d <= daysInMonth; d++) {
      const dayMovements = movementsForProduct.filter((m) => new Date(m.date).getDate() === d);
      let dayIn = 0;
      let dayOut = 0;
      let dayReturn = 0;
      for (const m of dayMovements) {
        if (m.qtyIn > 0) dayIn += m.qtyIn;
        if (m.qtyOut > 0) {
          dayOut += m.qtyOut;
          if (m.movementType === 'return_out') dayReturn += m.qtyOut;
        }
        if (m.deliveryNoteNumber) noteSet.add(m.deliveryNoteNumber);
      }
      running += dayIn - dayOut;

      const cell = row.getCell(5 + d);
      if (dayIn > 0) {
        cell.value = dayIn;
        cell.font = { color: { argb: 'FF1C7C71' }, bold: true };
      } else if (dayOut > 0) {
        const saleQty = dayOut - dayReturn;
        cell.value = dayReturn > 0
          ? (saleQty > 0 ? `${saleQty} - R${dayReturn}` : `R${dayReturn}`)
          : `${saleQty}`;
        cell.font = { color: { argb: dayReturn > 0 ? 'FFB5760B' : 'FFCC4757' }, bold: true };
        cell.alignment = { horizontal: 'center' };
      }
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
    }

    const totalQty = movementsForProduct.reduce((s, m) => s + m.qtyIn - m.qtyOut, 0);
    row.getCell(totalColIdx).value = totalQty;
    row.getCell(endingColIdx).value = running;
    row.getCell(endingColIdx).font = { bold: true, color: { argb: 'FFB23A48' } };

    row.eachCell((cell) => {
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
    });

    grandTotal += running;
    currentRow++;
  }
  closeGroupMerge(currentRow - 1);

  // Grand total row
  const totalRow = sheet.getRow(currentRow);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(endingColIdx).value = grandTotal;
  totalRow.getCell(endingColIdx).font = { bold: true, color: { argb: 'FFB23A48' } };

  sheet.views = [{ state: 'frozen', xSplit: 5, ySplit: 3 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `buku-stok-${counterId}-${year}-${String(month).padStart(2, '0')}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
