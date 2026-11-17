import { BadRequestException } from '@nestjs/common';
import {
  assertValidParent,
  buildTree,
  LOCATION_LEVEL,
  LOCATION_TYPE_LABEL,
} from './locations.rules.js';
import type { LocationTreeRow } from './locations.rules.js';

describe('LOCATION_LEVEL', () => {
  it('orders Kantor → Gedung → Lantai → Ruangan', () => {
    expect(LOCATION_LEVEL).toEqual({ OFFICE: 0, BUILDING: 1, FLOOR: 2, ROOM: 3 });
    expect(LOCATION_TYPE_LABEL).toEqual({
      OFFICE: 'Kantor',
      BUILDING: 'Gedung',
      FLOOR: 'Lantai',
      ROOM: 'Ruangan',
    });
  });
});

describe('assertValidParent', () => {
  it('accepts a parent exactly one level up', () => {
    expect(() => assertValidParent('ROOM', 'FLOOR')).not.toThrow();
    expect(() => assertValidParent('FLOOR', 'BUILDING')).not.toThrow();
    expect(() => assertValidParent('BUILDING', 'OFFICE')).not.toThrow();
  });

  it('accepts an office without a parent', () => {
    expect(() => assertValidParent('OFFICE', null)).not.toThrow();
  });

  it('rejects an office with any parent', () => {
    expect(() => assertValidParent('OFFICE', 'BUILDING')).toThrow(BadRequestException);
    expect(() => assertValidParent('OFFICE', 'OFFICE')).toThrow(
      'Kantor tidak memiliki lokasi induk.',
    );
  });

  it('rejects a parent of the wrong level', () => {
    expect(() => assertValidParent('ROOM', 'BUILDING')).toThrow(
      'Lokasi induk untuk Ruangan harus berupa Lantai.',
    );
    expect(() => assertValidParent('ROOM', 'ROOM')).toThrow(BadRequestException);
    expect(() => assertValidParent('FLOOR', 'OFFICE')).toThrow(
      'Lokasi induk untuk Lantai harus berupa Gedung.',
    );
  });

  it('rejects a missing parent below office level', () => {
    expect(() => assertValidParent('BUILDING', null)).toThrow(
      'Lokasi induk untuk Gedung harus berupa Kantor.',
    );
    expect(() => assertValidParent('ROOM', null)).toThrow(BadRequestException);
  });
});

describe('buildTree', () => {
  const row = (
    id: string,
    parentId: string | null,
    type: LocationTreeRow['type'],
    name: string,
    isActive = true,
  ): LocationTreeRow => ({ id, parentId, type, code: id.toUpperCase(), name, isActive });

  it('nests children under their parents, sorted by name', () => {
    const tree = buildTree([
      row('r2', 'f1', 'ROOM', 'Ruang 202'),
      row('f1', 'b1', 'FLOOR', 'Lantai 2'),
      row('hq', null, 'OFFICE', 'Kantor Pusat'),
      row('b1', 'hq', 'BUILDING', 'Gedung A'),
      row('r1', 'f1', 'ROOM', 'Ruang 201'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('hq');
    expect(tree[0].children[0].id).toBe('b1');
    expect(tree[0].children[0].children[0].id).toBe('f1');
    expect(tree[0].children[0].children[0].children.map((n) => n.name)).toEqual([
      'Ruang 201',
      'Ruang 202',
    ]);
  });

  it('treats rows whose parent is not in the set as roots', () => {
    const tree = buildTree([row('f9', 'missing', 'FLOOR', 'Lantai 9')]);
    expect(tree.map((n) => n.id)).toEqual(['f9']);
  });

  it('does not leak the parentId on nodes', () => {
    const [node] = buildTree([row('hq', null, 'OFFICE', 'Kantor Pusat')]);
    expect(node).toEqual({
      id: 'hq',
      code: 'HQ',
      name: 'Kantor Pusat',
      type: 'OFFICE',
      isActive: true,
      children: [],
    });
  });
});
