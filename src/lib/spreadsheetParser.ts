import ExcelJS from 'exceljs';
import Papa from 'papaparse';

/**
 * Generic CSV/Excel parser shared by every import feature (transactions,
 * products, promos, users, stock-incoming, stock-returns). Returns an
 * array of raw row objects keyed by the column header found in the file
 * (header normalization/aliasing is the caller's responsibility, since
 * each module has different expected columns).
 */
export async function parseCsvFile(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const text = buffer.toString('utf-8');
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data;
}

export async function parseExcelFile(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  const rows: Record<string, unknown>[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rawRow: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      let value = cell.value;
      if (value && typeof value === 'object' && 'result' in value) {
        value = (value as { result: unknown }).result;
      }
      rawRow[header] = value;
    });
    if (Object.values(rawRow).some((v) => v !== null && v !== undefined && v !== '')) {
      rows.push(rawRow);
    }
  });

  return rows;
}

/** Picks the right parser based on file extension. Throws on unsupported types. */
export async function parseSpreadsheetFile(
  buffer: Buffer,
  fileName: string
): Promise<Record<string, unknown>[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return parseCsvFile(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseExcelFile(buffer);
  throw new Error('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
}

/** Builds a normalized-header -> canonical-key lookup map for remapping rows. */
export function buildHeaderRemapper<T extends string>(
  aliases: Record<string, T>
): (rawRow: Record<string, unknown>) => Partial<Record<T, unknown>> {
  return (rawRow: Record<string, unknown>) => {
    const result: Partial<Record<T, unknown>> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      const normalized = key.trim().toLowerCase().replace(/\s+/g, '_');
      const canonical = aliases[normalized];
      if (canonical) {
        result[canonical] = value;
      }
    }
    return result;
  };
}

export function toNumberSafe(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toStringSafe(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}
