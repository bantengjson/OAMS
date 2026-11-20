import { disposalFormSchema, emptyDisposalForm, toDisposalPayload } from './disposal-form.schema';

const base = {
  ...emptyDisposalForm,
  assetId: '11111111-1111-4111-8111-111111111111',
  reason: 'SOLD' as const,
  disposedAt: '2026-11-20',
  description: 'Dijual ke pengepul',
};
const now = new Date('2026-11-20T03:00:00Z');

const fields = (values: object) => {
  const r = disposalFormSchema(now).safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path[0], message: i.message }));
};

describe('disposalFormSchema', () => {
  it('requires an asset, a description and a date not in the future', () => {
    expect(fields({ ...base, assetId: '' })).toContainEqual({ path: 'assetId', message: 'Pilih barang' });
    expect(fields({ ...base, description: '  ' })).toContainEqual({ path: 'description', message: 'Keterangan wajib diisi' });
    expect(fields({ ...base, disposedAt: '2026-11-21' })).toContainEqual({
      path: 'disposedAt',
      message: 'Tanggal tidak boleh di masa depan',
    });
    expect(fields(base)).toEqual([]);
  });

  it('accepts a plain numeric value and rejects thousand separators', () => {
    expect(fields({ ...base, value: '1500000' })).toEqual([]);
    expect(fields({ ...base, value: '1.500.000' }).map((f) => f.path)).toContain('value');
  });

  it('builds the payload with numbers and nulls', () => {
    expect(toDisposalPayload({ ...base, value: '1500000', recipient: ' Toko Jaya ' })).toEqual({
      assetId: base.assetId,
      reason: 'SOLD',
      disposedAt: '2026-11-20',
      description: 'Dijual ke pengepul',
      value: 1500000,
      recipient: 'Toko Jaya',
    });
    expect(toDisposalPayload(base)).toMatchObject({ value: null, recipient: null });
  });
});
