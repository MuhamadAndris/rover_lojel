import { Transaction, StockIncoming, StockReturn } from '@/models';
import { generateDocId } from './utils';

/** Generates the next sequential transactionId for a given date, e.g. TRX-20260618-0001 */
export async function getNextTransactionId(date: Date = new Date()): Promise<string> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const prefix = `TRX-${y}${m}${d}-`;

  const last = await Transaction.findOne({
    transactionId: { $regex: `^${prefix}` },
  })
    .sort({ transactionId: -1 })
    .lean();

  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.transactionId.split('-').pop() || '0', 10);
    nextSeq = lastSeq + 1;
  }

  return generateDocId('TRX', nextSeq, date);
}

export async function getNextIncomingId(date: Date = new Date()): Promise<string> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const prefix = `IN-${y}${m}${d}-`;

  const last = await StockIncoming.findOne({
    incomingId: { $regex: `^${prefix}` },
  })
    .sort({ incomingId: -1 })
    .lean();

  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.incomingId.split('-').pop() || '0', 10);
    nextSeq = lastSeq + 1;
  }

  return generateDocId('IN', nextSeq, date);
}

export async function getNextReturnId(date: Date = new Date()): Promise<string> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const prefix = `RTN-${y}${m}${d}-`;

  const last = await StockReturn.findOne({
    returnId: { $regex: `^${prefix}` },
  })
    .sort({ returnId: -1 })
    .lean();

  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.returnId.split('-').pop() || '0', 10);
    nextSeq = lastSeq + 1;
  }

  return generateDocId('RTN', nextSeq, date);
}
