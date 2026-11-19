import { z } from 'zod';
import type { LoanInput } from '@/lib/api/loans';
import { jakartaToday, shiftDays } from '@/lib/dates';
import { BORROWER_TYPES } from '@/types/api';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const loanFormSchema = z
  .object({
    assetId: z.string().min(1, 'Pilih barang'),
    borrowerType: z.enum(BORROWER_TYPES),
    borrowerEmployeeId: z.string(),
    borrowerName: z.string().trim().max(150, 'Maksimal 150 karakter'),
    borrowerDepartmentId: z.string(),
    borrowerContact: z.string().trim().max(100, 'Maksimal 100 karakter'),
    guarantorEmployeeId: z.string(),
    purpose: z.string().trim().max(2000, 'Maksimal 2000 karakter'),
    loanedAt: z.string().regex(DATE, 'Tanggal pinjam wajib diisi'),
    dueAt: z.string().regex(DATE, 'Rencana kembali wajib diisi'),
  })
  .superRefine((v, ctx) => {
    if (v.borrowerType === 'EMPLOYEE' && !v.borrowerEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['borrowerEmployeeId'], message: 'Pilih pegawai peminjam' });
    }
    if (v.borrowerType === 'EXTERNAL') {
      if (!v.borrowerName) ctx.addIssue({ code: 'custom', path: ['borrowerName'], message: 'Nama peminjam wajib diisi' });
      if (!v.guarantorEmployeeId) ctx.addIssue({ code: 'custom', path: ['guarantorEmployeeId'], message: 'Penjamin wajib diisi' });
    }
    if (DATE.test(v.loanedAt) && DATE.test(v.dueAt) && v.dueAt < v.loanedAt) {
      ctx.addIssue({ code: 'custom', path: ['dueAt'], message: 'Rencana kembali tidak boleh sebelum tanggal pinjam' });
    }
  });

export type LoanFormValues = z.infer<typeof loanFormSchema>;

export const emptyLoanForm: LoanFormValues = {
  assetId: '',
  borrowerType: 'EMPLOYEE',
  borrowerEmployeeId: '',
  borrowerName: '',
  borrowerDepartmentId: '',
  borrowerContact: '',
  guarantorEmployeeId: '',
  purpose: '',
  loanedAt: '',
  dueAt: '',
};

/** Today and a week from today, on the Jakarta calendar. */
export function defaultLoanDates(): Pick<LoanFormValues, 'loanedAt' | 'dueAt'> {
  const today = jakartaToday();
  return { loanedAt: today, dueAt: shiftDays(today, 7) };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function toLoanPayload(values: LoanFormValues): LoanInput {
  const employee = values.borrowerType === 'EMPLOYEE';
  return {
    assetId: values.assetId,
    borrowerType: values.borrowerType,
    borrowerEmployeeId: employee ? values.borrowerEmployeeId : null,
    borrowerName: employee ? null : orNull(values.borrowerName),
    borrowerDepartmentId: employee ? null : orNull(values.borrowerDepartmentId),
    borrowerContact: orNull(values.borrowerContact),
    guarantorEmployeeId: employee ? null : values.guarantorEmployeeId || null,
    purpose: orNull(values.purpose),
    loanedAt: values.loanedAt,
    dueAt: values.dueAt,
  };
}
