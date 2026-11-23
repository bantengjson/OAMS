import { z } from 'zod';
import type { MutationInput } from '@/lib/api/mutations';

/**
 * A mutation moves an item to another room, changes (or releases) its responsible person, or both.
 * The asset code never changes: its room letter is the room where the item was registered.
 */
export const mutationFormSchema = z
  .object({
    assetId: z.string().min(1, 'Pilih barang'),
    /** Destination room; empty = the room stays. */
    toLocationId: z.string(),
    responsibleMode: z.enum(['keep', 'change', 'release']),
    toResponsibleEmployeeId: z.string(),
    reason: z.string().trim().min(1, 'Alasan wajib diisi').max(2000, 'Maksimal 2000 karakter'),
  })
  .superRefine((v, ctx) => {
    if (v.responsibleMode === 'change' && !v.toResponsibleEmployeeId) {
      ctx.addIssue({ code: 'custom', path: ['toResponsibleEmployeeId'], message: 'Pilih penanggung jawab baru' });
    }
    if (!v.toLocationId && v.responsibleMode === 'keep') {
      ctx.addIssue({ code: 'custom', path: ['toLocationId'], message: 'Pilih ruangan tujuan atau ubah penanggung jawab' });
    }
  });

export type MutationFormValues = z.infer<typeof mutationFormSchema>;

export const emptyMutationForm: MutationFormValues = {
  assetId: '',
  toLocationId: '',
  responsibleMode: 'keep',
  toResponsibleEmployeeId: '',
  reason: '',
};

export function toMutationPayload(values: MutationFormValues): MutationInput {
  return {
    assetId: values.assetId,
    toLocationId: values.toLocationId || null,
    changesResponsible: values.responsibleMode !== 'keep',
    toResponsibleEmployeeId: values.responsibleMode === 'change' ? values.toResponsibleEmployeeId : null,
    reason: values.reason.trim(),
  };
}
