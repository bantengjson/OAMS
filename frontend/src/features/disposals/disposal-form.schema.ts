import { z } from 'zod';
import type { DisposalInput } from '@/lib/api/disposals';
import { jakartaToday } from '@/lib/dates';
import { DISPOSAL_REASONS } from '@/types/api';

/** Built per render so "today" is the Jakarta date at the moment the form is checked. */
export const disposalFormSchema = (now: Date = new Date()) =>
  z.object({
    assetId: z.string().min(1, 'Pilih barang'),
    reason: z.enum(DISPOSAL_REASONS),
    disposedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi')
      .refine((v) => v <= jakartaToday(now), 'Tanggal tidak boleh di masa depan'),
    description: z.string().trim().min(1, 'Keterangan wajib diisi').max(2000, 'Maksimal 2000 karakter'),
    value: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Nilai berupa angka tanpa pemisah ribuan'),
    recipient: z.string().trim().max(150, 'Maksimal 150 karakter'),
  });

export type DisposalFormValues = z.infer<ReturnType<typeof disposalFormSchema>>;

export const emptyDisposalForm: DisposalFormValues = {
  assetId: '',
  reason: 'BROKEN',
  disposedAt: '',
  description: '',
  value: '',
  recipient: '',
};

export function toDisposalPayload(values: DisposalFormValues): DisposalInput {
  const value = values.value.trim();
  const recipient = values.recipient.trim();
  return {
    assetId: values.assetId,
    reason: values.reason,
    disposedAt: values.disposedAt,
    description: values.description.trim(),
    value: value ? Number(value) : null,
    recipient: recipient || null,
  };
}
