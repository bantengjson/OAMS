import { emptyMutationForm, mutationFormSchema, toMutationPayload } from './mutation-form.schema';

const base = { ...emptyMutationForm, assetId: '11111111-1111-4111-8111-111111111111', reason: 'Serah terima' };
const ROOM = '22222222-2222-4222-8222-222222222222';

describe('mutationFormSchema', () => {
  it('needs at least one change: a room or the responsible person', () => {
    const nothing = mutationFormSchema.safeParse(base);
    expect(nothing.success).toBe(false);
    expect(mutationFormSchema.safeParse({ ...base, toLocationId: ROOM }).success).toBe(true);
    expect(mutationFormSchema.safeParse({ ...base, responsibleMode: 'release' }).success).toBe(true);
  });

  it('requires a new responsible when changing it', () => {
    const missing = mutationFormSchema.safeParse({ ...base, responsibleMode: 'change' });
    expect(missing.success ? [] : missing.error.issues.map((i) => i.path[0])).toContain('toResponsibleEmployeeId');
    expect(mutationFormSchema.safeParse({ ...base, responsibleMode: 'change', toResponsibleEmployeeId: 'e1' }).success).toBe(true);
  });

  it('requires a reason and an asset', () => {
    const noReason = mutationFormSchema.safeParse({ ...base, toLocationId: ROOM, reason: '  ' });
    expect(noReason.success ? [] : noReason.error.issues.map((i) => i.path[0])).toContain('reason');
    const noAsset = mutationFormSchema.safeParse({ ...base, assetId: '', toLocationId: ROOM });
    expect(noAsset.success ? [] : noAsset.error.issues.map((i) => i.path[0])).toContain('assetId');
  });
});

describe('toMutationPayload', () => {
  it('moves the room only', () => {
    expect(toMutationPayload({ ...base, toLocationId: ROOM })).toEqual({
      assetId: base.assetId,
      toLocationId: ROOM,
      changesResponsible: false,
      toResponsibleEmployeeId: null,
      reason: 'Serah terima',
    });
  });

  it('changes or releases the responsible person, with or without a room', () => {
    expect(toMutationPayload({ ...base, responsibleMode: 'change', toResponsibleEmployeeId: 'e1' })).toMatchObject({
      toLocationId: null,
      changesResponsible: true,
      toResponsibleEmployeeId: 'e1',
    });
    expect(toMutationPayload({ ...base, toLocationId: ROOM, responsibleMode: 'release' })).toMatchObject({
      toLocationId: ROOM,
      changesResponsible: true,
      toResponsibleEmployeeId: null,
    });
  });
});
