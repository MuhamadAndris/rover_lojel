import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { connectDB } from './mongodb';
import { Transaction } from '@/models';
import { createTransaction } from './transactionService';
import { getNextTransactionId } from './idGenerator';
import { generateItemId, calcPromoValueFromDescription } from './utils';

/**
 * Expected columns (header names, case-insensitive, flexible aliases):
 *  transaction_id (optional — if blank/repeated rows share the same id,
 *                  they get grouped into ONE transaction with multiple items)
 *  date
 *  counter_id
 *  bon_number
 *  product_id
 *  product_description (optional — if blank, will be looked up from Product master)
 *  qty
 *  normal_price
 *  promo_description
 *  promo_value (optional — if blank, derived from promo_description when possible)
 *  final_price
 *  sale_by_user_id
 *  post_by_user_id
 *  spv_id
 *  status (optional — defaults to "success")
 *  notes (optional)
 */
export interface RawImportRow {
  transaction_id?: string;
  date: string;
  counter_id: string;
  bon_number: string;
  product_id: string;
  product_description?: string;
  qty: string | number;
  normal_price: string | number;
  promo_description?: string;
  promo_value?: string | number;
  final_price: string | number;
  sale_by_user_id: string;
  post_by_user_id: string;
  spv_id: string;
  status?: string;
  notes?: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  transactionsCreated: number;
  itemsImported: number;
  errors: ImportRowError[];
}

const HEADER_ALIASES: Record<string, keyof RawImportRow> = {
  transaction_id: 'transaction_id',
  transactionid: 'transaction_id',
  trx_id: 'transaction_id',
  date: 'date',
  tanggal: 'date',
  counter_id: 'counter_id',
  counterid: 'counter_id',
  counter: 'counter_id',
  bon_number: 'bon_number',
  bonnumber: 'bon_number',
  bon: 'bon_number',
  no_bon: 'bon_number',
  product_id: 'product_id',
  productid: 'product_id',
  sku: 'product_id',
  product_description: 'product_description',
  productdescription: 'product_description',
  description: 'product_description',
  qty: 'qty',
  quantity: 'qty',
  normal_price: 'normal_price',
  normalprice: 'normal_price',
  price: 'normal_price',
  promo_description: 'promo_description',
  promodescription: 'promo_description',
  promo: 'promo_description',
  promo_value: 'promo_value',
  promovalue: 'promo_value',
  final_price: 'final_price',
  finalprice: 'final_price',
  sale_by_user_id: 'sale_by_user_id',
  salebyuserid: 'sale_by_user_id',
  sale_id: 'sale_by_user_id',
  sa_id: 'sale_by_user_id',
  post_by_user_id: 'post_by_user_id',
  postbyuserid: 'post_by_user_id',
  post_by: 'post_by_user_id',
  spv_id: 'spv_id',
  spvid: 'spv_id',
  status: 'status',
  notes: 'notes',
  keterangan: 'notes',
};

function normalizeHeader(header: string): keyof RawImportRow | null {
  const key = header.trim().toLowerCase().replace(/\s+/g, '_');
  return HEADER_ALIASES[key] || null;
}

function remapRow(rawRow: Record<string, unknown>): Partial<RawImportRow> {
  const result: Partial<RawImportRow> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const normalized = normalizeHeader(key);
    if (normalized) {
      (result as Record<string, unknown>)[normalized] = value;
    }
  }
  return result;
}

export async function parseCsvBuffer(buffer: Buffer): Promise<Partial<RawImportRow>[]> {
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data.map(remapRow);
}

export async function parseExcelBuffer(buffer: Buffer): Promise<Partial<RawImportRow>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  const rows: Partial<RawImportRow>[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const rawRow: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      let value = cell.value;
      // ExcelJS dates come back as Date objects already
      if (value && typeof value === 'object' && 'result' in value) {
        value = (value as { result: unknown }).result;
      }
      rawRow[header] = value;
    });
    if (Object.values(rawRow).some((v) => v !== null && v !== undefined && v !== '')) {
      rows.push(remapRow(rawRow));
    }
  });

  return rows;
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,.](?=\d{3}\b)/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value: string | number | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Validates and groups raw rows into transactions, then persists them.
 * Rows sharing the same transaction_id (or, if blank, the same combination
 * of date+counter_id+bon_number) are grouped into a single transaction with
 * multiple items.
 */
export async function importTransactionRows(
  rows: Partial<RawImportRow>[],
  importedBy: string
): Promise<ImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  const groups = new Map<string, { meta: Partial<RawImportRow>; items: RawImportRow[] }>();

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexing

    const date = toDate(row.date);
    if (!date) {
      errors.push({ row: rowNum, message: 'Tanggal tidak valid atau kosong' });
      return;
    }
    if (!row.counter_id || !/^[A-Za-z0-9]{3}$/.test(String(row.counter_id))) {
      errors.push({ row: rowNum, message: 'Counter ID harus 3 karakter' });
      return;
    }
    if (!row.product_id || !/^\d{9}$/.test(String(row.product_id))) {
      errors.push({ row: rowNum, message: 'Product ID harus 9 digit angka' });
      return;
    }
    if (!row.sale_by_user_id || !/^\d{7}$/.test(String(row.sale_by_user_id))) {
      errors.push({ row: rowNum, message: 'Sale by User ID harus 7 digit angka' });
      return;
    }
    if (!row.spv_id || !/^\d{7}$/.test(String(row.spv_id))) {
      errors.push({ row: rowNum, message: 'SPV ID harus 7 digit angka' });
      return;
    }
    if (!row.bon_number) {
      errors.push({ row: rowNum, message: 'Nomor bon wajib diisi' });
      return;
    }

    const qty = toNumber(row.qty, 0);
    if (qty <= 0) {
      errors.push({ row: rowNum, message: 'Qty harus lebih dari 0' });
      return;
    }

    const normalPrice = toNumber(row.normal_price, 0);
    let promoValue = toNumber(row.promo_value, NaN);
    if (Number.isNaN(promoValue)) {
      promoValue = row.promo_description
        ? calcPromoValueFromDescription(String(row.promo_description), normalPrice, qty)
        : 0;
    }
    const finalPrice = toNumber(row.final_price, normalPrice * qty - promoValue);

    const groupKey =
      row.transaction_id && String(row.transaction_id).trim() !== ''
        ? String(row.transaction_id).trim()
        : `${date.toISOString().slice(0, 10)}|${row.counter_id}|${row.bon_number}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { meta: row, items: [] });
    }

    groups.get(groupKey)!.items.push({
      ...row,
      date: date.toISOString(),
      qty,
      normal_price: normalPrice,
      promo_value: promoValue,
      final_price: finalPrice,
    } as RawImportRow);
  });

  let transactionsCreated = 0;
  let itemsImported = 0;

  for (const [groupKey, group] of groups) {
    const meta = group.meta;
    const date = toDate(meta.date) as Date;

    const explicitId =
      meta.transaction_id && String(meta.transaction_id).trim() !== ''
        ? String(meta.transaction_id).trim()
        : null;

    // Skip if this transactionId already exists (idempotent re-import)
    if (explicitId) {
      const exists = await Transaction.findOne({ transactionId: explicitId }).lean();
      if (exists) {
        errors.push({
          row: 0,
          message: `Transaction ID "${explicitId}" sudah ada, dilewati`,
        });
        continue;
      }
    }

    const transactionId = explicitId || (await getNextTransactionId(date));

    try {
      const txn = await createTransaction({
        transactionId,
        date,
        counterId: String(meta.counter_id),
        bonNumber: String(meta.bon_number),
        items: group.items.map((it) => ({
          itemId: generateItemId(),
          productId: String(it.product_id),
          productDescription: String(it.product_description || it.product_id),
          qty: Number(it.qty),
          normalPrice: Number(it.normal_price),
          promoDescription: it.promo_description ? String(it.promo_description) : null,
          promoValue: Number(it.promo_value || 0),
          finalPrice: Number(it.final_price),
        })),
        saleByUserId: String(meta.sale_by_user_id),
        postByUserId: String(meta.post_by_user_id || importedBy),
        spvId: String(meta.spv_id),
        status: (meta.status as 'success' | 'cancel' | 'exchange') || 'success',
        notes: meta.notes ? String(meta.notes) : undefined,
        source: 'import',
      });

      transactionsCreated += 1;
      itemsImported += txn.items.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengimpor grup transaksi';
      errors.push({ row: 0, message: `[${groupKey}] ${message}` });
    }
  }

  return {
    totalRows: rows.length,
    transactionsCreated,
    itemsImported,
    errors,
  };
}
