import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDate(date: Date | string, withTime = false): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

/** Generate a sequential-looking human ID: PREFIX-YYYYMMDD-XXXX */
export function generateDocId(prefix: string, sequence: number, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `${prefix}-${y}${m}${d}-${seq}`;
}

export function generateItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse "10%" / "20+10%" promo strings against a normal price to get the discount value */
export function calcPromoValueFromDescription(
  promoDescription: string,
  normalPrice: number,
  qty: number
): number {
  const desc = promoDescription.trim().toUpperCase();

  // Match chained percentages like "20+10%" or single "10%"
  const percentMatch = desc.match(/^(\d+(?:\+\d+)*)%$/);
  if (percentMatch) {
    const steps = percentMatch[1].split('+').map(Number);
    let price = normalPrice;
    for (const step of steps) {
      price = price - price * (step / 100);
    }
    return Math.round((normalPrice - price) * qty);
  }

  // BUY 1 GET 1 -> every 2nd unit free
  if (desc.includes('BUY 1 GET 1') || desc.includes('B1G1')) {
    const freeUnits = Math.floor(qty / 2);
    return Math.round(freeUnits * normalPrice);
  }

  // SPECIAL PRICE or anything else -> cannot auto-calc, caller must supply manually
  return 0;
}

export const PRODUCT_ID_REGEX = /^\d{9}$/;
export const USER_ID_REGEX = /^\d{7}$/;
export const COUNTER_ID_REGEX = /^[A-Za-z0-9]{3}$/;
