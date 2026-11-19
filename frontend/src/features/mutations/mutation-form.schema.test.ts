import { emptyMutationForm, mutationFormSchema, toMutationPayload } from './mutation-form.schema';

const base = { ...emptyMutationForm, assetId: '11111111-1111-4111-8111-111111111111', reason: 'Pindah ruang' };

describe('mutationFormSchema', () => {
  it('requires at least one change', () => {
    const result = mutationFormSchema.safeParse(base);
    expect(result.success).toBe(false);
    const issue = result.success ? null : result.error.issues[0];
    expect(issue?.path).toEqual(['moveLocation']);
    expect(issue?.message).toBe('Pilih minimal satu perubahan');
  });

  it('requires a destination when moving and an employee when changing the responsible', () => {
    const move = mutationFormSchema.safeParse({ ...base, moveLocation: true });
    expect(move.success).toBe(false);
    expect(move.success ? [] : move.error.issues.map((i) => i.path[0])).toContain('toLocationId');

    const pj = mutationFormSchema.safeParse({ ...base, changeResponsible: true });
    expect(pj.success).toBe(false);
    expect(pj.success ? [] : pj.error.issues.map((i) => i.path[0])).toContain('toResponsibleEmployeeId');
  });

  it('accepts releasing the responsible person without picking anyone', () => {
    const values = { ...base, changeResponsible: true, releaseResponsible: true };
    expect(mutationFormSchema.safeParse(values).success).toBe(true);
    expect(toMutationPayload(values)).toEqual({
      assetId: base.assetId,
      toLocationId: null,
      changesResponsible: true,
      toResponsibleEmployeeId: null,
      reason: 'Pindah ruang',
    });
  });

  it('sends only the location when that is the only change', () => {
    const values = { ...base, moveLocation: true, toLocationId: '22222222-2222-4222-8222-222222222222' };
    expect(mutationFormSchema.safeParse(values).success).toBe(true);
    expect(toMutationPayload(values)).toEqual({
      assetId: base.assetId,
      toLocationId: '22222222-2222-4222-8222-222222222222',
      changesResponsible: false,
      toResponsibleEmployeeId: null,
      reason: 'Pindah ruang',
    });
  });

  it('requires a reason', () => {
    const result = mutationFormSchema.safeParse({ ...base, moveLocation: true, toLocationId: 'x', reason: '  ' });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((i) => i.path[0])).toContain('reason');
  });
});
