import { z } from 'zod';
import type { AssetInput, AssetUpdateInput } from '@/lib/api/assets';
import { ASSET_CONDITIONS, ASSET_STATUSES, OWNERSHIP_TYPES } from '@/types/api';
import type { AssetDetail, Golongan } from '@/types/api';

const optionalText = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);

export const assetFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama barang wajib diisi').max(200, 'Maksimal 200 karakter'),
  categoryId: z.string().min(1, 'Pilih jenis barang'),
  /** Room; the rules depend on the type (see placementError). */
  locationId: z.string(),
  /** Empty is allowed here; `yearProblem` decides (required on create, optional for an imported TT item). */
  acquisitionYear: z
    .string()
    .trim()
    .refine((v) => v === '' || /^(19|20)\d{2}$/.test(v), 'Tahun pengadaan 4 digit, mis. 2023'),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100, 'Jumlah unit 1-100'),
  ownershipType: z.enum(OWNERSHIP_TYPES),
  condition: z.enum(ASSET_CONDITIONS),
  status: z.enum(ASSET_STATUSES),
  specification: optionalText(500),
  source: optionalText(300),
  serialNumber: optionalText(100),
  description: optionalText(2000),
  vendor: optionalText(150),
  notes: optionalText(2000),
  acquisitionDate: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Format tanggal YYYY-MM-DD'),
  purchasePrice: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v),
      'Harga berupa angka tanpa pemisah ribuan, mis. 1500000',
    ),
  departmentId: z.string(),
  responsibleEmployeeId: z.string(),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;

export const emptyAssetForm: AssetFormValues = {
  name: '',
  categoryId: '',
  locationId: '',
  acquisitionYear: '',
  quantity: '1',
  ownershipType: 'OFFICE',
  condition: 'GOOD',
  status: 'IN_USE',
  specification: '',
  source: '',
  serialNumber: '',
  description: '',
  vendor: '',
  notes: '',
  acquisitionDate: '',
  purchasePrice: '',
  departmentId: '',
  responsibleEmployeeId: '',
};

/** What decides the room rule: vehicles (BG) and land (NG 001) have no room, every other NG needs one. */
export interface PlacementType {
  golongan: Golongan;
  number: number;
}

export const usesNoRoom = (t: PlacementType) => t.golongan === 'BG' || t.number === 1;

/**
 * The year is part of the code: required when registering, and an item imported without one
 * (code `…/TT-01`) may stay without one, but a stored year is never cleared.
 */
export function yearProblem(mode: 'create' | 'edit', storedYear: number | null, value: string): string | null {
  if (value.trim()) return null;
  if (mode === 'create') return 'Tahun pengadaan wajib diisi';
  return storedYear === null ? null : 'Tahun yang sudah terisi tidak bisa dikosongkan';
}

export function placementError(type: PlacementType, locationId: string): string | null {
  if (usesNoRoom(type)) {
    if (!locationId) return null;
    return type.golongan === 'BG' ? 'Kendaraan tidak memakai ruangan.' : 'Tanah & bangunan tidak memakai ruangan.';
  }
  return locationId ? null : 'Ruangan wajib diisi.';
}

const textOrNull = (v: string | undefined): string | null => {
  const t = v?.trim() ?? '';
  return t ? t : null;
};

export function toAssetPayload(values: AssetFormValues, type: PlacementType): AssetInput {
  const price = values.purchasePrice.trim();
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    locationId: usesNoRoom(type) ? null : textOrNull(values.locationId),
    acquisitionYear: Number(values.acquisitionYear),
    quantity: Number(values.quantity || '1'),
    ownershipType: values.ownershipType,
    condition: values.condition,
    status: values.status,
    specification: textOrNull(values.specification),
    source: textOrNull(values.source),
    serialNumber: textOrNull(values.serialNumber),
    description: textOrNull(values.description),
    vendor: textOrNull(values.vendor),
    notes: textOrNull(values.notes),
    acquisitionDate: textOrNull(values.acquisitionDate),
    purchasePrice: price ? Number(price) : null,
    departmentId: textOrNull(values.departmentId),
    responsibleEmployeeId: textOrNull(values.responsibleEmployeeId),
  };
}

/** Statuses set only by loans, repairs and disposals; never chosen by hand or sent back from the form. */
export const FLOW_STATUSES: readonly string[] = ['BORROWED', 'RETURNED', 'UNDER_MAINTENANCE', 'MISSING', 'DISPOSED'];

/**
 * Edit payload: responsible and condition never; jenis and room only while the sticker was never
 * printed (a correction re-codes the item); an empty year is not sent, so an imported TT item stays TT.
 */
export function toAssetUpdatePayload(values: AssetFormValues, type: PlacementType, printed: boolean): AssetUpdateInput {
  const out: AssetUpdateInput & Partial<AssetInput> = toAssetPayload(values, type);
  delete out.quantity;
  delete out.responsibleEmployeeId;
  delete out.condition;
  if (printed) {
    delete out.categoryId;
    delete out.locationId;
  }
  if (!values.acquisitionYear.trim()) delete out.acquisitionYear;
  // An asset on loan, in repair or disposed carries that flow's status in the form; sending it back would be refused.
  if (out.status && FLOW_STATUSES.includes(out.status)) delete out.status;
  return out;
}

export function fromAssetDetail(asset: AssetDetail): AssetFormValues {
  return {
    name: asset.name,
    categoryId: asset.category.id,
    locationId: asset.room?.id ?? '',
    acquisitionYear: asset.acquisitionYear ? String(asset.acquisitionYear) : '',
    quantity: '1',
    ownershipType: asset.ownershipType,
    condition: asset.condition,
    status: asset.status,
    specification: asset.specification ?? '',
    source: asset.source ?? '',
    serialNumber: asset.serialNumber ?? '',
    description: asset.description ?? '',
    vendor: asset.vendor ?? '',
    notes: asset.notes ?? '',
    acquisitionDate: asset.acquisitionDate ?? '',
    purchasePrice: asset.purchasePrice ? String(Number(asset.purchasePrice)) : '',
    departmentId: asset.department?.id ?? '',
    responsibleEmployeeId: asset.responsibleEmployee?.id ?? '',
  };
}
