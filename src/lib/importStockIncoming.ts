import { connectDB } from './mongodb';
import { StockIncoming } from '@/models';
import { applyIncomingStock } from './stockService';
import { getNextIncomingId } from './idGenerator';
import { buildHeaderRemapper, toStringSafe, toNumberSafe, toDateSafe } from './spreadsheetParser';
import { generateItemId } from './utils';

type IncomingKey =
  | 'incomingId' | 'date' | 'counterId' | 'supplierName' | 'deliveryNoteNumber'
  | 'productId' | 'productDescription' | 'qty' | 'notes';

const ALIASES: Record<string, IncomingKey> = {
  incoming_id: 'incomingId',
  incomingid: 'incomingId',
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
  notes: 'notes',
  keterangan: 'notes',
};

const remap = buildHeaderRemapper(ALIASES);

export interface ImportRowError { row: number; message: string; }
export interface IncomingImportResult {
  totalRows: number;
  documentsCreated: number;
  itemsImported: number;
  errors: ImportRowError[];
}

/**
 * Rows sharing the same incoming_id (or, if blank, the same
 * date + counter_id + delivery_note_number) are grouped into a single
 * StockIncoming document with multiple items — same pattern as transaction
 * import. Photo upload is not supported via import; it must be attached
 * manually afterwards through the edit screen if needed.
 */
export async function importIncomingRows(
  rawRows: Record<string, unknown>[],
  importedBy: string
): Promise<IncomingImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  const groups = new Map<string, {
    date: Date; counterId: string; supplierName?: string; deliveryNoteNumber?: string; notes?: string;
    items: { productId: string; productDescription: string; qty: number }[];
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

    const incomingId = toStringSafe(row.incomingId);
    const deliveryNoteNumber = toStringSafe(row.deliveryNoteNumber);
    const groupKey = incomingId || `${date.toISOString().slice(0, 10)}|${counterId}|${deliveryNoteNumber}`;

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
    });
  });

  let documentsCreated = 0;
  let itemsImported = 0;

  for (const [, group] of groups) {
    try {
      const incomingId = await getNextIncomingId(group.date);
      const doc = await StockIncoming.create({
        incomingId,
        date: group.date,
        counterId: group.counterId,
        supplierName: group.supplierName,
        deliveryNoteNumber: group.deliveryNoteNumber,
        deliveryNotePhoto: null,
        items: group.items.map((it) => ({ ...it, itemId: generateItemId() })),
        status: 'received',
        createdBy: importedBy,
        updatedBy: importedBy,
        notes: group.notes,
        source: 'import',
      });

      await applyIncomingStock({
        incomingId: doc.incomingId,
        date: doc.date,
        counterId: doc.counterId,
        items: doc.items.map((it) => ({ productId: it.productId, productDescription: it.productDescription, qty: it.qty })),
        createdBy: importedBy,
        deliveryNoteNumber: doc.deliveryNoteNumber,
      });

      documentsCreated++;
      itemsImported += doc.items.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan grup barang datang';
      errors.push({ row: 0, message });
    }
  }

  return { totalRows: rawRows.length, documentsCreated, itemsImported, errors };
}
