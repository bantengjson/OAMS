import { z } from 'zod';

export const itemTypeSchema = z.object({
  golongan: z.enum(['BG', 'NG'], { message: 'Pilih golongan' }),
  /** Empty = next free number in the golongan. */
  number: z
    .string()
    .trim()
    .transform((v) => (v === '' ? undefined : Number(v)))
    .pipe(z.number().int('Nomor harus angka bulat').min(1, 'Nomor 1-999').max(999, 'Nomor 1-999').optional()),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(150),
  isGroup: z.boolean(),
});
export type ItemTypeFormInput = z.input<typeof itemTypeSchema>;
export type ItemTypeFormValues = z.output<typeof itemTypeSchema>;

export const roomSchema = z.object({
  name: z.string().trim().min(1, 'Nama ruangan wajib diisi').max(150),
});
export type RoomFormValues = z.output<typeof roomSchema>;

export const orgCodeSchema = z.object({
  value: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, '2-10 huruf atau angka tanpa spasi')),
});
