import { connectDB } from './mongodb';
import { Product } from '@/models';
import { buildHeaderRemapper, toStringSafe } from './spreadsheetParser';

type ProductKey = 'productId' | 'brand' | 'name' | 'color' | 'size' | 'status';

const ALIASES: Record<string, ProductKey> = {
  product_id: 'productId',
  productid: 'productId',
  sku: 'productId',
  brand: 'brand',
  name: 'name',
  nama: 'name',
  color: 'color',
  warna: 'color',
  size: 'size',
  ukuran: 'size',
  status: 'status',
};

const remap = buildHeaderRemapper(ALIASES);

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ProductImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

export async function importProductRows(
  rawRows: Record<string, unknown>[],
  importedBy: string
): Promise<ProductImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2;
    const row = remap(rawRows[i]);

    const productId = toStringSafe(row.productId);
    const brand = toStringSafe(row.brand);
    const name = toStringSafe(row.name);
    const color = toStringSafe(row.color);
    const size = toStringSafe(row.size);
    const status = toStringSafe(row.status).toLowerCase() || 'active';

    if (!/^\d{9}$/.test(productId)) {
      errors.push({ row: rowNum, message: 'Product ID harus 9 digit angka' });
      continue;
    }
    if (!brand || !name || !color || !size) {
      errors.push({ row: rowNum, message: 'Brand, nama, warna, dan ukuran wajib diisi' });
      continue;
    }
    if (!['active', 'inactive', 'discontinued'].includes(status)) {
      errors.push({ row: rowNum, message: `Status "${status}" tidak valid` });
      continue;
    }

    try {
      const existing = await Product.findOne({ productId });
      if (existing) {
        existing.brand = brand;
        existing.name = name;
        existing.color = color;
        existing.size = size;
        existing.status = status as 'active' | 'inactive' | 'discontinued';
        existing.updatedBy = importedBy;
        await existing.save();
        updated++;
      } else {
        await Product.create({
          productId, brand, name, color, size,
          status, createdBy: importedBy, updatedBy: importedBy,
        });
        created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan baris';
      errors.push({ row: rowNum, message });
    }
  }

  return { totalRows: rawRows.length, created, updated, errors };
}
