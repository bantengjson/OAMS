import { z } from 'zod';
import type { MutationInput } from '@/lib/api/mutations';

export const mutationFormSchema = z
  .object({
    assetId: z.string().min(1, 'Pilih barang'),
    moveLocation: z.boolean(),
    toLocationId: z.string(),
    changeResponsible: z.boolean(),
    /** "Lepaskan": the asset ends up with no responsible person. */
    releaseResponsible: z.boolean(),
    toResponsibleEmployeeId: z.string(),
    reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000, 'Maksimal 2000 karakter'),
  })
  .superRefine((v, ctx) => {
    if (!v.moveLocation && !v.changeResponsible) {
      ctx.addIssue({ code: 'custom', path: ['moveLocation'], message: 'Pilih minimal satu perubahan' });
    }
    if (v.moveLocation && !v.toLocationId) {
      ctx.addIssue({ code: 'custom', path: ['toLocationId'], message: 'Pilih lokasi tujuan' });
    }
    if (v.changeResponsible && !v.releaseResponsible && !v.toResponsibleEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['toResponsibleEmployeeId'], message: 'Pilih penanggung jawab baru' });
    }
  });

export type MutationFormValues = z.infer<typeof mutationFormSchema>;

export const emptyMutationForm: MutationFormValues = {
  assetId: '',
  moveLocation: false,
  toLocationId: '',
  changeResponsible: false,
  releaseResponsible: false,
  toResponsibleEmployeeId: '',
  reason: '',
};

export function toMutationPayload(values: MutationFormValues): MutationInput {
  return {
    assetId: values.assetId,
    toLocationId: values.moveLocation ? values.toLocationId : null,
    changesResponsible: values.changeResponsible,
    toResponsibleEmployeeId:
      values.changeResponsible && !values.releaseResponsible ? values.toResponsibleEmployeeId : null,
    reason: values.reason.trim(),
  };
}
