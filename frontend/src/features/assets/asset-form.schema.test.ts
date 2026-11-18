import { assetFormSchema, emptyAssetForm, toAssetPayload } from './asset-form.schema';

const valid = {
  ...emptyAssetForm,
  name: 'Laptop Kerja',
  categoryId: '11111111-1111-4111-8111-111111111111',
  locationId: '22222222-2222-4222-8222-222222222222',
  ownershipType: 'OFFICE' as const,
  acquisitionMethod: 'PURCHASE' as const,
  condition: 'GOOD' as const,
  status: 'AVAILABLE' as const,
};

describe('assetFormSchema', () => {
  it('requires name, category and location', () => {
    const result = assetFormSchema.safeParse({ ...valid, name: ' ', categoryId: '', locationId: '' });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'categoryId', 'locationId']));
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
      responsibleUserId: '',
      notes: '',
    });
    expect(payload).toMatchObject({
      name: 'Laptop Kerja',
      brand: 'Lenovo',
      model: null,
      purchasePrice: 1500000,
      acquisitionDate: null,
      departmentId: null,
      responsibleUserId: null,
      notes: null,
    });
  });

  it('keeps a filled price and date', () => {
    const payload = toAssetPayload({ ...valid, purchasePrice: '250000.75', acquisitionDate: '2026-02-01' });
    expect(payload.purchasePrice).toBe(250000.75);
    expect(payload.acquisitionDate).toBe('2026-02-01');
  });
});
