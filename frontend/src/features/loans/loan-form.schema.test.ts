import { emptyLoanForm, loanFormSchema, toLoanPayload } from './loan-form.schema';

const base = {
  ...emptyLoanForm,
  assetId: '11111111-1111-4111-8111-111111111111',
  loanedAt: '2026-11-19',
  dueAt: '2026-11-26',
};

const issues = (values: object) => {
  const r = loanFormSchema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => ({ path: i.path[0], message: i.message }));
};

describe('loanFormSchema', () => {
  it('requires a guarantor and a name for an external borrower', () => {
    const list = issues({ ...base, borrowerType: 'EXTERNAL' });
    expect(list).toContainEqual({ path: 'guarantorEmployeeId', message: 'Penjamin wajib diisi' });
    expect(list).toContainEqual({ path: 'borrowerName', message: 'Nama peminjam wajib diisi' });
  });

  it('requires picking an employee for an employee borrower', () => {
    expect(issues({ ...base, borrowerType: 'EMPLOYEE' })).toContainEqual({
      path: 'borrowerEmployeeId',
      message: 'Pilih pegawai peminjam',
    });
  });

  it('refuses a due date before the loan date', () => {
    expect(issues({ ...base, borrowerType: 'EMPLOYEE', borrowerEmployeeId: 'e1', dueAt: '2026-11-18' })).toContainEqual({
      path: 'dueAt',
      message: 'Rencana kembali tidak boleh sebelum tanggal pinjam',
    });
  });

  it('builds an employee payload without a typed name', () => {
    const values = { ...base, borrowerType: 'EMPLOYEE' as const, borrowerEmployeeId: 'e1', borrowerName: 'ignored' };
    expect(issues(values)).toEqual([]);
    expect(toLoanPayload(values)).toEqual({
      assetId: base.assetId,
      borrowerType: 'EMPLOYEE',
      borrowerEmployeeId: 'e1',
      borrowerName: null,
      borrowerDepartmentId: null,
      borrowerContact: null,
      guarantorEmployeeId: null,
      purpose: null,
      loanedAt: '2026-11-19',
      dueAt: '2026-11-26',
    });
  });

  it('builds an external payload with the guarantor and contact', () => {
    const values = {
      ...base,
      borrowerType: 'EXTERNAL' as const,
      borrowerName: ' Rina ',
      borrowerContact: '0812',
      guarantorEmployeeId: 'e2',
      purpose: 'Acara keluarga',
    };
    expect(issues(values)).toEqual([]);
    expect(toLoanPayload(values)).toMatchObject({
      borrowerType: 'EXTERNAL',
      borrowerEmployeeId: null,
      borrowerName: 'Rina',
      borrowerContact: '0812',
      guarantorEmployeeId: 'e2',
      purpose: 'Acara keluarga',
    });
  });
});
