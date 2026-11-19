import { emptyMutationForm, mutationFormSchema, toMutationPayload } from './mutation-form.schema';

const base = { ...emptyMutationForm, assetId: '11111111-1111-4111-8111-111111111111', reason: 'Serah terima' };

describe('mutationFormSchema (responsible person only)', () => {
  it('requires a new responsible unless the asset is released', () => {
    const missing = mutationFormSchema.safeParse(base);
    expect(missing.success).toBe(false);
    expect(missing.success ? [] : missing.error.issues.map((i) => i.path[0])).toContain('toResponsibleEmployeeId');
    expect(mutationFormSchema.safeParse({ ...base, releaseResponsible: true }).success).toBe(true);
    expect(mutationFormSchema.safeParse({ ...base, toResponsibleEmployeeId: 'e1' }).success).toBe(true);
  });

  it('requires a reason and an asset', () => {
    const noReason = mutationFormSchema.safeParse({ ...base, toResponsibleEmployeeId: 'e1', reason: '  ' });
    expect(noReason.success ? [] : noReason.error.issues.map((i) => i.path[0])).toContain('reason');
    const noAsset = mutationFormSchema.safeParse({ ...base, assetId: '', toResponsibleEmployeeId: 'e1' });
    expect(noAsset.success ? [] : noAsset.error.issues.map((i) => i.path[0])).toContain('assetId');
  });

  it('builds a responsible-only payload, never touching the location', () => {
    expect(toMutationPayload({ ...base, toResponsibleEmployeeId: 'e1' })).toEqual({
      assetId: base.assetId,
      toLocationId: null,
      changesResponsible: true,
      toResponsibleEmployeeId: 'e1',
      reason: 'Serah terima',
    });
    expect(toMutationPayload({ ...base, releaseResponsible: true })).toMatchObject({
      changesResponsible: true,
      toResponsibleEmployeeId: null,
    });
  });
});
