import { connectDB } from './mongodb';
import { StockReturn } from '@/models';
import { applyReturnStock } from './stockService';
import { getNextReturnId } from './idGenerator';
import { buildHeaderRemapper, toStringSafe, toNumberSafe, toDateSafe } from './spreadsheetParser';
import { generateItemId } from './utils';

type ReturnKey =
  | 'returnId' | 'date' | 'counterId' | 'supplierName' | 'deliveryNoteNumber'
  | 'productId' | 'productDescription' | 'qty' | 'reason' | 'notes';

const ALIASES: Record<string, ReturnKey> = {
  return_id: 'returnId',
  returnid: 'returnId',
  date: 'date',
  tanggal: 'date',
  counter_id: 'counterId',
  counterid: 'counterId',
  counter: 'counterId',
  supplier_name: 'supplierName',
  suppliername: 'supplierName',
  supplier: 'supplierName',
  delivery_note_number: 'deliveryNoteNumber',
  deliverynotenumber: 'deliveryNoteNumber',
  no_surat_jalan: 'deliveryNoteNumber',
  surat_jalan: 'deliveryNoteNumber',
  product_id: 'productId',
  productid: 'productId',
  sku: 'productId',
  product_description: 'productDescription',
  productdescription: 'productDescription',
  description: 'productDescription',
  qty: 'qty',
  quantity: 'qty',
  reason: 'reason',
  alasan: 'reason',
  notes: 'notes',
  keterangan: 'notes',
};

const remap = buildHeaderRemapper(ALIASES);

export interface ImportRowError { row: number; message: string; }
export interface ReturnImportResult {
  totalRows: number;
  documentsCreated: number;
  itemsImported: number;
  errors: ImportRowError[];
}

export async function importReturnRows(
  rawRows: Record<string, unknown>[],
  importedBy: string
): Promise<ReturnImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  const groups = new Map<string, {
    date: Date; counterId: string; supplierName?: string; deliveryNoteNumber?: string; notes?: string;
    items: { productId: string; productDescription: string; qty: number; reason?: string }[];
  }>();

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2;
    const row = remap(raw);

    const date = toDateSafe(row.date);
    const counterId = toStringSafe(row.counterId).toUpperCase();
    const productId = toStringSafe(row.productId);
    const qty = toNumberSafe(row.qty);

    if (!date) { errors.push({ row: rowNum, message: 'Tanggal tidak valid atau kosong' }); return; }
    if (!/^[A-Za-z0-9]{3}$/.test(counterId)) { errors.push({ row: rowNum, message: 'Counter ID harus 3 karakter' }); return; }
    if (!/^\d{9}$/.test(productId)) { errors.push({ row: rowNum, message: 'Product ID harus 9 digit angka' }); return; }
    if (qty <= 0) { errors.push({ row: rowNum, message: 'Qty harus lebih dari 0' }); return; }

    const returnId = toStringSafe(row.returnId);
    const deliveryNoteNumber = toStringSafe(row.deliveryNoteNumber);
    const groupKey = returnId || `${date.toISOString().slice(0, 10)}|${counterId}|${deliveryNoteNumber}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        date, counterId,
        supplierName: toStringSafe(row.supplierName) || undefined,
        deliveryNoteNumber: deliveryNoteNumber || undefined,
        notes: toStringSafe(row.notes) || undefined,
        items: [],
      });
    }
    groups.get(groupKey)!.items.push({
      productId,
      productDescription: toStringSafe(row.productDescription) || productId,
      qty,
      reason: toStringSafe(row.reason) || undefined,
    });
  });

  let documentsCreated = 0;
  let itemsImported = 0;

  for (const [, group] of groups) {
    try {
      const returnId = await getNextReturnId(group.date);
      const doc = await StockReturn.create({
        returnId,
        date: group.date,
        counterId: group.counterId,
        supplierName: group.supplierName,
        deliveryNoteNumber: group.deliveryNoteNumber,
        deliveryNotePhoto: null,
        items: group.items.map((it) => ({ ...it, itemId: generateItemId() })),
        status: 'sent',
        createdBy: importedBy,
        updatedBy: importedBy,
        notes: group.notes,
        source: 'import',
      });

      await applyReturnStock({
        returnId: doc.returnId,
        date: doc.date,
        counterId: doc.counterId,
        items: doc.items.map((it) => ({ productId: it.productId, productDescription: it.productDescription, qty: it.qty })),
        createdBy: importedBy,
        deliveryNoteNumber: doc.deliveryNoteNumber,
      });

      documentsCreated++;
      itemsImported += doc.items.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan grup return barang';
      errors.push({ row: 0, message });
    }
  }

  return { totalRows: rawRows.length, documentsCreated, itemsImported, errors };
}
