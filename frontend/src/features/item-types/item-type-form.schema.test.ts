import { describe, expect, it } from 'vitest';
import { itemTypeSchema, roomSchema, orgCodeSchema } from './item-type-form.schema';

describe('item type form', () => {
  it('needs a golongan and a name; the number may be left empty', () => {
    expect(itemTypeSchema.parse({ golongan: 'NG', number: '', name: ' Kursi Merah ', isGroup: false })).toEqual({
      golongan: 'NG',
      number: undefined,
      name: 'Kursi Merah',
      isGroup: false,
    });
    expect(itemTypeSchema.safeParse({ golongan: '', number: '', name: 'X', isGroup: false }).success).toBe(false);
    expect(itemTypeSchema.safeParse({ golongan: 'NG', number: '', name: ' ', isGroup: false }).success).toBe(false);
  });

  it('accepts a number 1-999 only', () => {
    expect(itemTypeSchema.parse({ golongan: 'BG', number: '7', name: 'Motor', isGroup: false }).number).toBe(7);
    expect(itemTypeSchema.safeParse({ golongan: 'BG', number: '0', name: 'Motor', isGroup: false }).success).toBe(false);
    expect(itemTypeSchema.safeParse({ golongan: 'BG', number: '1000', name: 'Motor', isGroup: false }).success).toBe(false);
    expect(itemTypeSchema.safeParse({ golongan: 'BG', number: '1.5', name: 'Motor', isGroup: false }).success).toBe(false);
  });
});

describe('room form', () => {
  it('needs a name', () => {
    expect(roomSchema.parse({ name: '  Ruang Arsip ' })).toEqual({ name: 'Ruang Arsip' });
    expect(roomSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('organisation code', () => {
  it('upper-cases 2-10 letters or digits', () => {
    expect(orgCodeSchema.parse({ value: ' dpc ' })).toEqual({ value: 'DPC' });
    expect(orgCodeSchema.safeParse({ value: 'd p c' }).success).toBe(false);
    expect(orgCodeSchema.safeParse({ value: 'D' }).success).toBe(false);
  });
});
