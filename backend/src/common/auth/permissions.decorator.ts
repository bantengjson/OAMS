import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from './permissions.catalog.js';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** Every listed permission is required (all-of). */
export const RequirePermissions = (...codes: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
