import { describe, expect, it } from 'vitest';
import { ASSET_CONDITIONS } from '@/types/api';
import { CONDITION_LABEL } from './asset-labels';

describe('condition labels', () => {
  it('uses the office three-level scale', () => {
    expect(ASSET_CONDITIONS).toEqual(['GOOD', 'NEEDS_REPAIR', 'DAMAGED']);
    expect(CONDITION_LABEL).toEqual({ GOOD: 'Baik', NEEDS_REPAIR: 'Perlu Perbaikan', DAMAGED: 'Rusak' });
  });
});
