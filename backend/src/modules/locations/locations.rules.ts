import { BadRequestException } from '@nestjs/common';
import type { LocationType } from '../../generated/prisma/client.js';

/** Kantor → Gedung → Lantai → Ruangan */
export const LOCATION_TYPES = ['OFFICE', 'BUILDING', 'FLOOR', 'ROOM'] as const;

export const LOCATION_LEVEL: Record<LocationType, number> = {
  OFFICE: 0,
  BUILDING: 1,
  FLOOR: 2,
  ROOM: 3,
};

export const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  OFFICE: 'Kantor',
  BUILDING: 'Gedung',
  FLOOR: 'Lantai',
  ROOM: 'Ruangan',
};

/** The only type allowed as parent of `type`, or null for an office. */
export function parentTypeOf(type: LocationType): LocationType | null {
  const level = LOCATION_LEVEL[type];
  if (level === 0) return null;
  return LOCATION_TYPES[level - 1];
}

/**
 * Enforces the strict hierarchy: an office has no parent; every other type
 * must sit exactly one level below its parent.
 */
export function assertValidParent(type: LocationType, parentType: LocationType | null): void {
  const expected = parentTypeOf(type);
  if (expected === null) {
    if (parentType !== null) {
      throw new BadRequestException('Kantor tidak memiliki lokasi induk.');
    }
    return;
  }
  if (parentType !== expected) {
    throw new BadRequestException(
      `Lokasi induk untuk ${LOCATION_TYPE_LABEL[type]} harus berupa ${LOCATION_TYPE_LABEL[expected]}.`,
    );
  }
}

export interface LocationTreeRow {
  id: string;
  parentId: string | null;
  type: LocationType;
  code: string;
  name: string;
  isActive: boolean;
}

export interface LocationTreeNode {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  isActive: boolean;
  children: LocationTreeNode[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'id');

/** Nests flat rows into a tree; rows whose parent is absent become roots. */
export function buildTree(rows: LocationTreeRow[]): LocationTreeNode[] {
  const nodes = new Map<string, LocationTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      children: [],
    });
  }
  const roots: LocationTreeNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortDeep = (list: LocationTreeNode[]) => {
    list.sort(byName);
    for (const n of list) sortDeep(n.children);
  };
  sortDeep(roots);
  return roots;
}

/** Builds "Kantor Pusat / Gedung A / Lantai 2 / Ruang 201" from an id→row map. */
export function buildPath(
  id: string,
  byId: Map<string, { name: string; parentId: string | null }>,
): string {
  const names: string[] = [];
  let current: string | null = id;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = byId.get(current);
    if (!row) break;
    names.unshift(row.name);
    current = row.parentId;
  }
  return names.join(' / ');
}
