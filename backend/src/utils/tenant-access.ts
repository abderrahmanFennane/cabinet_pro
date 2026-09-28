import { ALL_PERMISSION_KEYS, PermissionKey, ROLE_PERMISSIONS } from '../types/permissions';

export const CABINET_ROLES = ['OWNER', 'PRACTITIONER', 'ASSISTANT'];

export function canAccessCabinet(role: string, userCabinetId: string | null | undefined, requestedCabinetId: string | undefined) {
  if (role === 'SUPER_ADMIN') return true;
  if (!requestedCabinetId || !userCabinetId) return false;
  return CABINET_ROLES.includes(role) && userCabinetId === requestedCabinetId;
}

/** Role permissions filtered by the plan's feature keys. No plan found = no plan restriction. */
export function effectivePermissions(role: string, planPermissions: PermissionKey[] | null): PermissionKey[] {
  if (role === 'SUPER_ADMIN') return [...ALL_PERMISSION_KEYS];
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  if (!planPermissions) return rolePermissions;
  return rolePermissions.filter(p => planPermissions.includes(p));
}

export function parsePermissionList(value: unknown): PermissionKey[] {
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is PermissionKey => typeof p === 'string' && ALL_PERMISSION_KEYS.includes(p as PermissionKey));
  } catch {
    return [];
  }
}
