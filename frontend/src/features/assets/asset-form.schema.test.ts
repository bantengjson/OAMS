import {
  assetFormSchema,
  emptyAssetForm,
  placementError,
  toAssetPayload,
  toAssetUpdatePayload,
} from './asset-form.schema';

const valid = {
  ...emptyAssetForm,
  name: 'Laptop Kerja',
  categoryId: '11111111-1111-4111-8111-111111111111',
  locationId: '22222222-2222-4222-8222-222222222222',
  acquisitionYear: '2025',
  ownershipType: 'OFFICE' as const,
  condition: 'GOOD' as const,
  status: 'AVAILABLE' as const,
};

const NG = { golongan: 'NG' as const, number: 12 };
const BG = { golongan: 'BG' as const, number: 4 };
const LAND = { golongan: 'NG' as const, number: 1 };

describe('assetFormSchema', () => {
  it('requires name, type and year', () => {
    const result = assetFormSchema.safeParse({ ...valid, name: ' ', categoryId: '', acquisitionYear: '' });
    const fields = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'categoryId', 'acquisitionYear']));
  });

  it('takes a four-digit year and a quantity of 1-100', () => {
    expect(assetFormSchema.safeParse({ ...valid, acquisitionYear: '23' }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...valid, quantity: '0' }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...valid, quantity: '101' }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...valid, quantity: '12' }).success).toBe(true);
  });

  it('accepts a plain numeric price and rejects thousand separators or negatives', () => {
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '1500000.50' }).success).toBe(true);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '1.500.000' }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '-5' }).success).toBe(false);
  });
});

describe('placementError', () => {
  it('needs a room for ordinary NG items', () => {
    expect(placementError(NG, '')).toBe('Ruangan wajib diisi.');
    expect(placementError(NG, 'room')).toBeNull();
  });

  it('refuses a room for vehicles and land', () => {
    expect(placementError(BG, 'room')).toBe('Kendaraan tidak memakai ruangan.');
    expect(placementError(BG, '')).toBeNull();
    expect(placementError(LAND, 'room')).toBe('Tanah & bangunan tidak memakai ruangan.');
  });
});

describe('toAssetPayload', () => {
  it('sends year, specification, source and quantity; empty optionals become null', () => {
    const payload = toAssetPayload({ ...valid, specification: '  Lenovo T14 ', source: '', quantity: '3', purchasePrice: '1500000' }, NG);
    expect(payload).toMatchObject({
      name: 'Laptop Kerja',
      acquisitionYear: 2025,
      specification: 'Lenovo T14',
      source: null,
      quantity: 3,
      locationId: valid.locationId,
      purchasePrice: 1500000,
      departmentId: null,
    });
    expect(payload).not.toHaveProperty('acquisitionMethod');
  });

  it('drops the room for a vehicle', () => {
    expect(toAssetPayload({ ...valid }, BG).locationId).toBeNull();
  });
});

describe('toAssetUpdatePayload', () => {
  it('never sends responsible, condition or quantity; keeps jenis and room while unprinted', () => {
    const payload = toAssetUpdatePayload({ ...valid, responsibleEmployeeId: 'x', condition: 'NEEDS_REPAIR', status: 'STORED', quantity: '4' }, NG, false);
    expect(payload).not.toHaveProperty('responsibleEmployeeId');
    expect(payload).not.toHaveProperty('condition');
    expect(payload).not.toHaveProperty('quantity');
    expect(payload).toMatchObject({ categoryId: valid.categoryId, locationId: valid.locationId, status: 'STORED' });
  });

  it('leaves jenis and room out once the sticker was printed', () => {
    const payload = toAssetUpdatePayload({ ...valid }, NG, true);
    expect(payload).not.toHaveProperty('categoryId');
    expect(payload).not.toHaveProperty('locationId');
  });

  it('does not send an empty year (an imported TT item stays TT)', () => {
    expect(toAssetUpdatePayload({ ...valid, acquisitionYear: '' }, NG, false)).not.toHaveProperty('acquisitionYear');
  });

  it.each(['BORROWED', 'UNDER_MAINTENANCE', 'MISSING', 'DISPOSED'] as const)('drops the flow status %s', (status) => {
    const payload = toAssetUpdatePayload({ ...valid, status, name: 'Printer' }, NG, false);
    expect(payload).not.toHaveProperty('status');
    expect(payload).toMatchObject({ name: 'Printer' });
  });
});
