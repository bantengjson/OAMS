import { describe, expect, it } from 'vitest';
import { categoryOptions } from './category-options';

const all = [
  { id: 'a', name: 'Elektronik', isActive: true },
  { id: 'b', name: 'Lama', isActive: false },
];

describe('categoryOptions', () => {
  it('lists active categories only when nothing unusual is selected', () => {
    expect(categoryOptions(all, '')).toEqual([{ value: 'a', label: 'Elektronik' }]);
    expect(categoryOptions(all, 'a')).toEqual([{ value: 'a', label: 'Elektronik' }]);
  });

  it('shows a selected inactive category so the filter explains itself', () => {
    expect(categoryOptions(all, 'b')).toContainEqual({ value: 'b', label: 'Lama (nonaktif)' });
  });

  it('shows an unknown selected id as such instead of pretending all categories are shown', () => {
    expect(categoryOptions(all, 'zzz')).toContainEqual({ value: 'zzz', label: 'Kategori tidak dikenal' });
  });
});
