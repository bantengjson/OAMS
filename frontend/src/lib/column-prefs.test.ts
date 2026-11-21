import { beforeEach, describe, expect, it } from 'vitest';
import { loadColumnPrefs, saveColumnPrefs } from './column-prefs';
import type { ColumnDef } from './column-prefs';

const columns: ColumnDef[] = [
  { key: 'code', label: 'Kode', required: true },
  { key: 'name', label: 'Nama', required: true },
  { key: 'category', label: 'Kategori' },
  { key: 'department', label: 'Unit kerja' },
];
const defaults = ['code', 'name', 'category'];

describe('column prefs', () => {
  beforeEach(() => localStorage.clear());

  it('uses the defaults when nothing is stored', () => {
    expect([...loadColumnPrefs('assets', columns, defaults)].sort()).toEqual(['category', 'code', 'name']);
  });

  it('round-trips a saved choice and ignores unknown keys', () => {
    saveColumnPrefs('assets', new Set(['code', 'name', 'department', 'ghost']));
    expect([...loadColumnPrefs('assets', columns, defaults)].sort()).toEqual(['code', 'department', 'name']);
  });

  it('always keeps required columns', () => {
    localStorage.setItem('oams.columns.assets', JSON.stringify(['category']));
    expect([...loadColumnPrefs('assets', columns, defaults)].sort()).toEqual(['category', 'code', 'name']);
  });

  it('falls back to the defaults on corrupt storage', () => {
    localStorage.setItem('oams.columns.assets', '{not json');
    expect([...loadColumnPrefs('assets', columns, defaults)].sort()).toEqual(['category', 'code', 'name']);
  });
});
