import { connectDB } from './mongodb';
import { User } from '@/models';
import { buildHeaderRemapper, toStringSafe } from './spreadsheetParser';
import bcrypt from 'bcryptjs';

type UserKey = 'userId' | 'name' | 'role' | 'password' | 'counterId' | 'status';

const ALIASES: Record<string, UserKey> = {
  user_id: 'userId',
  userid: 'userId',
  id: 'userId',
  name: 'name',
  nama: 'name',
  role: 'role',
  password: 'password',
  counter_id: 'counterId',
  counterid: 'counterId',
  counter: 'counterId',
  status: 'status',
};

const remap = buildHeaderRemapper(ALIASES);
const VALID_ROLES = ['super_admin', 'admin_post', 'spv', 'sa'];

export interface ImportRowError {
  row: number;
  message: string;
}

export interface UserImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

/**
 * Imports users from CSV/Excel. New users require a `password` column
 * (will be hashed). Existing users (matched by userId) are updated for
 * name/role/counterId/status — their password is left untouched unless
 * a non-empty `password` value is provided in the row.
 */
export async function importUserRows(
  rawRows: Record<string, unknown>[],
  importedBy: string
): Promise<UserImportResult> {
  await connectDB();

  const errors: ImportRowError[] = [];
  let created = 0;
  let updated = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2;
    const row = remap(rawRows[i]);

    const userId = toStringSafe(row.userId);
    const name = toStringSafe(row.name);
    const role = toStringSafe(row.role).toLowerCase();
    const password = toStringSafe(row.password);
    const counterId = toStringSafe(row.counterId).toUpperCase();
    const status = toStringSafe(row.status).toLowerCase() || 'active';

    if (!/^\d{7}$/.test(userId)) {
      errors.push({ row: rowNum, message: 'User ID harus 7 digit angka' });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, message: 'Nama wajib diisi' });
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      errors.push({ row: rowNum, message: `Role "${role}" tidak valid (gunakan: ${VALID_ROLES.join(', ')})` });
      continue;
    }
    if (counterId && !/^[A-Za-z0-9]{3}$/.test(counterId)) {
      errors.push({ row: rowNum, message: 'Counter ID harus 3 karakter' });
      continue;
    }
    if (!['active', 'inactive'].includes(status)) {
      errors.push({ row: rowNum, message: `Status "${status}" tidak valid` });
      continue;
    }

    try {
      const existing = await User.findOne({ userId });
      if (existing) {
        existing.name = name;
        existing.role = role as 'super_admin' | 'admin_post' | 'spv' | 'sa';
        existing.status = status as 'active' | 'inactive';
        if (counterId) existing.counterId = counterId;
        if (password) {
          existing.passwordHash = await bcrypt.hash(password, 10);
        }
        await existing.save();
        updated++;
      } else {
        if (!password || password.length < 6) {
          errors.push({ row: rowNum, message: 'Password wajib diisi (min. 6 karakter) untuk user baru' });
          continue;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await User.create({
          userId, name, role, passwordHash,
          counterId: counterId || undefined,
          status,
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
