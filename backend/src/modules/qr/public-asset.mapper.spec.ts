import { PUBLIC_ASSET_KEYS, toPublicAsset } from './public-asset.mapper.js';

// Deliberately wider than PublicAssetSource: the mapper must drop every extra key.
const source = {
  assetCode: 'INV-2026-0001',
  name: 'Laptop',
  brand: 'Lenovo',
  model: 'T14',
  status: 'IN_USE' as const,
  condition: 'GOOD' as const,
  serialNumber: 'SN-RAHASIA',
  purchasePrice: '15000000.00',
  vendor: 'PT Rahasia',
  notes: 'catatan internal',
  category: { id: 'c1', code: 'ELEKTRONIK', name: 'Elektronik' },
  location: { id: 'l1', code: 'R1', name: 'Ruang 201', path: 'Kantor / Gedung A / Lantai 2 / Ruang 201' },
  responsibleEmployee: { id: 'e1', fullName: 'Budi', department: null },
  photos: [{ id: 'p1' }],
};

describe('toPublicAsset', () => {
  it('exposes exactly the public keys and nothing else', () => {
    const dto = toPublicAsset(source);
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_ASSET_KEYS].sort());
    expect(dto).toEqual({
      assetCode: 'INV-2026-0001',
      name: 'Laptop',
      brand: 'Lenovo',
      model: 'T14',
      status: 'IN_USE',
      condition: 'GOOD',
      category: { name: 'Elektronik' },
      location: { name: 'Ruang 201', path: 'Kantor / Gedung A / Lantai 2 / Ruang 201' },
      hasPhoto: true,
    });
    expect(JSON.stringify(dto)).not.toMatch(/RAHASIA|15000000|Rahasia|catatan|Budi|u1|c1|l1/);
  });

  it('reports hasPhoto false without photos', () => {
    expect(toPublicAsset({ ...source, photos: [] }).hasPhoto).toBe(false);
  });
});

describe('toPublicAsset without a location', () => {
  it('keeps the location key as null', () => {
    const result = toPublicAsset({ ...source, location: null } as never);
    expect(result.location).toBeNull();
    expect(Object.keys(result).sort()).toEqual([...PUBLIC_ASSET_KEYS].sort());
  });
});
