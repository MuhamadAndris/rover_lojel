import { connectDB } from './mongodb';
import { Promo } from '@/models';
import { buildHeaderRemapper, toStringSafe, toNumberSafe, toDateSafe } from './spreadsheetParser';

type PromoKey =
  | 'promoId' | 'productId' | 'productDescription' | 'promoDescription'
  | 'promoValue' | 'normalPrice' | 'finalPrice' | 'startDate' | 'endDate';

const ALIASES: Record<string, PromoKey> = {
  promo_id: 'promoId',
  promoid: 'promoId',
  product_id: 'productId',
  productid: 'productId',
  sku: 'productId',
  product_description: 'productDescription',
  productdescription: 'productDescription',
  description: 'productDescription',
  promo_description: 'promoDescription',
  promodescription: 'promoDescription',
  promo: 'promoDescription',
  promo_value: 'promoValue',
  promovalue: 'promoValue',
  normal_price: 'normalPrice',
  normalprice: 'normalPrice',
  price: 'normalPrice',
  final_price: 'finalPrice',
  finalprice: 'finalPrice',
  start_date: 'startDate',
  startdate: 'startDate',
  tanggal_mulai: 'startDate',
  end_date: 'endDate',
  enddate: 'endDate',
  tanggal_berakhir: 'endDate',
};

const remap = buildHeaderRemapper(ALIASES);

export interface ImportRowError {
  row: number;
  message: string;
}

export interface PromoImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

export async function importPromoRows(
  rawRows: Record<string, unknown>[],
  importedBy: string
): Promise<PromoImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2;
    const row = remap(rawRows[i]);

    const promoId = toStringSafe(row.promoId);
    const productId = toStringSafe(row.productId);
    const productDescription = toStringSafe(row.productDescription);
    const promoDescription = toStringSafe(row.promoDescription);
    const normalPrice = toNumberSafe(row.normalPrice);
    const promoValue = toNumberSafe(row.promoValue);
    const finalPrice = toNumberSafe(row.finalPrice, normalPrice - promoValue);
    const startDate = toDateSafe(row.startDate) ?? new Date();
    const endDate = toDateSafe(row.endDate); // null if blank/invalid -> no end date

    if (!promoId) {
      errors.push({ row: rowNum, message: 'Promo ID wajib diisi' });
      continue;
    }
    if (!/^\d{9}$/.test(productId)) {
      errors.push({ row: rowNum, message: 'Product ID harus 9 digit angka' });
      continue;
    }
    if (!productDescription || !promoDescription) {
      errors.push({ row: rowNum, message: 'Deskripsi produk dan deskripsi promo wajib diisi' });
      continue;
    }

    try {
      const existing = await Promo.findOne({ promoId });
      if (existing) {
        const snapshot = {
          promoDescription: existing.promoDescription,
          promoValue: existing.promoValue,
          normalPrice: existing.normalPrice,
          finalPrice: existing.finalPrice,
          startDate: existing.startDate,
          endDate: existing.endDate,
        };
        existing.productId = productId;
        existing.productDescription = productDescription;
        existing.promoDescription = promoDescription;
        existing.promoValue = promoValue;
        existing.normalPrice = normalPrice;
        existing.finalPrice = finalPrice;
        existing.startDate = startDate;
        existing.endDate = endDate;
        existing.updatedBy = importedBy;
        existing.history.push({ action: 'updated', changedBy: importedBy, changedAt: new Date(), snapshot });
        await existing.save();
        updated++;
      } else {
        await Promo.create({
          promoId, productId, productDescription, promoDescription,
          promoValue, normalPrice, finalPrice, startDate, endDate,
          createdBy: importedBy, updatedBy: importedBy,
          history: [{ action: 'created', changedBy: importedBy, changedAt: new Date(), snapshot: {} }],
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
