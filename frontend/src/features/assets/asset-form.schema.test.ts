import { assetFormSchema, emptyAssetForm, toAssetPayload, toAssetUpdatePayload } from './asset-form.schema';

const valid = {
  ...emptyAssetForm,
  name: 'Laptop Kerja',
  categoryId: '11111111-1111-4111-8111-111111111111',
  ownershipType: 'OFFICE' as const,
  acquisitionMethod: 'PURCHASE' as const,
  condition: 'GOOD' as const,
  status: 'AVAILABLE' as const,
};

describe('assetFormSchema', () => {
  it('requires name and category but no location', () => {
    const result = assetFormSchema.safeParse({ ...valid, name: ' ', categoryId: '' });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'categoryId']));
    expect(fields).not.toContain('locationId');
    expect(assetFormSchema.safeParse({ ...valid, locationId: undefined }).success).toBe(true);
  });

  it('accepts a plain numeric price and rejects thousand separators or negatives', () => {
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '1500000' }).success).toBe(true);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '1500000.50' }).success).toBe(true);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '' }).success).toBe(true);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '1.500.000' }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...valid, purchasePrice: '-5' }).success).toBe(false);
  });

  it('validates the acquisition date format when given', () => {
    expect(assetFormSchema.safeParse({ ...valid, acquisitionDate: '2026-01-15' }).success).toBe(true);
    expect(assetFormSchema.safeParse({ ...valid, acquisitionDate: '15/01/2026' }).success).toBe(false);
  });
});

describe('toAssetPayload', () => {
  it('turns empty optionals into null and the price into a number', () => {
    const payload = toAssetPayload({
      ...valid,
      brand: '  Lenovo ',
      model: '',
      purchasePrice: '1500000',
      acquisitionDate: '',
      departmentId: '',
      responsibleEmployeeId: '',
      notes: '',
    });
    expect(payload).toMatchObject({
      name: 'Laptop Kerja',
      brand: 'Lenovo',
      model: null,
      purchasePrice: 1500000,
      acquisitionDate: null,
      departmentId: null,
      responsibleEmployeeId: null,
      notes: null,
    });
  });

  it('keeps a filled price and date', () => {
    const payload = toAssetPayload({ ...valid, purchasePrice: '250000.75', acquisitionDate: '2026-02-01' });
    expect(payload.purchasePrice).toBe(250000.75);
    expect(payload.acquisitionDate).toBe('2026-02-01');
  });
});

describe('toAssetUpdatePayload', () => {
  it('never sends the fields that only a mutation or a condition check may change', () => {
    const payload = toAssetUpdatePayload({
      ...valid,
      responsibleEmployeeId: '33333333-3333-4333-8333-333333333333',
      condition: 'NEEDS_REPAIR',
      status: 'STORED',
      notes: 'disimpan',
    });
    expect(payload).not.toHaveProperty('locationId');
    expect(payload).not.toHaveProperty('responsibleEmployeeId');
    expect(payload).not.toHaveProperty('condition');
    expect(payload).toMatchObject({ status: 'STORED', notes: 'disimpan', name: 'Laptop Kerja' });
  });
});

describe('toAssetUpdatePayload while borrowed', () => {
  it('drops a loan-managed status so the rest of the form can still be saved', () => {
    const payload = toAssetUpdatePayload({ ...valid, status: 'BORROWED', notes: 'masih dipinjam' });
    expect(payload).not.toHaveProperty('status');
    expect(payload).toMatchObject({ notes: 'masih dipinjam' });
    expect(toAssetUpdatePayload({ ...valid, status: 'STORED' })).toMatchObject({ status: 'STORED' });
  });
});

describe('toAssetUpdatePayload while a repair or disposal owns the status', () => {
  it.each(['UNDER_MAINTENANCE', 'MISSING', 'DISPOSED'] as const)('drops %s so other fields can still be saved', (status) => {
    const payload = toAssetUpdatePayload({ ...valid, status, name: 'Printer Lantai 1' });
    expect(payload).not.toHaveProperty('status');
    expect(payload).toMatchObject({ name: 'Printer Lantai 1' });
  });
});
