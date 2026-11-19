import { z } from 'zod';
import type { MutationInput } from '@/lib/api/mutations';

/**
 * Single-office setup: a mutation only changes the responsible person. The
 * API still accepts a destination location; this form never sends one.
 */
export const mutationFormSchema = z
  .object({
    assetId: z.string().min(1, 'Pilih barang'),
    /** "Lepaskan": the asset ends up with no responsible person. */
    releaseResponsible: z.boolean(),
    toResponsibleEmployeeId: z.string(),
    reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000, 'Maksimal 2000 karakter'),
  })
  .superRefine((v, ctx) => {
    if (!v.releaseResponsible && !v.toResponsibleEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['toResponsibleEmployeeId'], message: 'Pilih penanggung jawab baru' });
    }
  });

export type MutationFormValues = z.infer<typeof mutationFormSchema>;

export const emptyMutationForm: MutationFormValues = {
  assetId: '',
  releaseResponsible: false,
  toResponsibleEmployeeId: '',
  reason: '',
};

export function toMutationPayload(values: MutationFormValues): MutationInput {
  return {
    assetId: values.assetId,
    toLocationId: null,
    changesResponsible: true,
    toResponsibleEmployeeId: values.releaseResponsible ? null : values.toResponsibleEmployeeId,
    reason: values.reason.trim(),
  };
}
