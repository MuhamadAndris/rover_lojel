import type { UserRole } from '@/models';

/**
 * Centralized role permission matrix.
 *
 * Roles:
 *  - super_admin : full access to everything, including user management
 *  - admin_post  : day-to-day data entry & operations (transactions, stock,
 *                  products, promos) but cannot manage users
 *  - spv         : supervisor — can view everything for their counter(s),
 *                  approve/verify, view reports, but limited write access
 *  - sa          : sales associate — can create their own transactions,
 *                  view their own performance, read-only on master data
 */

export type Permission =
  | 'transaction:create'
  | 'transaction:edit'
  | 'transaction:delete'
  | 'transaction:import'
  | 'transaction:view_all' // view all counters/SAs, not just own
  | 'stock:manage' // create incoming/return
  | 'stock:view'
  | 'stock:export'
  | 'product:manage'
  | 'product:view'
  | 'promo:manage'
  | 'promo:view'
  | 'report:view'
  | 'target:manage'
  | 'user:manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'transaction:create',
    'transaction:edit',
    'transaction:delete',
    'transaction:import',
    'transaction:view_all',
    'stock:manage',
    'stock:view',
    'stock:export',
    'product:manage',
    'product:view',
    'promo:manage',
    'promo:view',
    'report:view',
    'target:manage',
    'user:manage',
  ],
  admin_post: [
    'transaction:create',
    'transaction:edit',
    'transaction:delete',
    'transaction:import',
    'transaction:view_all',
    'stock:manage',
    'stock:view',
    'stock:export',
    'product:manage',
    'product:view',
    'promo:manage',
    'promo:view',
    'report:view',
  ],
  spv: [
    'transaction:create',
    'transaction:edit',
    'transaction:view_all',
    'stock:view',
    'stock:export',
    'product:view',
    'promo:view',
    'report:view',
    'target:manage',
  ],
  sa: [
    'transaction:create',
    'stock:view',
    'product:view',
    'promo:view',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    const err = new Error('Forbidden: insufficient permission');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin_post: 'Admin / Post',
  spv: 'Supervisor',
  sa: 'Sales Associate',
};
