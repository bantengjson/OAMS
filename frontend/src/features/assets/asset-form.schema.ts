import { z } from 'zod';
import type { AssetInput, AssetUpdateInput } from '@/lib/api/assets';
import {
  ACQUISITION_METHODS,
  ASSET_CONDITIONS,
  ASSET_STATUSES,
  OWNERSHIP_TYPES,
} from '@/types/api';
import type { AssetDetail } from '@/types/api';

const optionalText = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);

export const assetFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama barang wajib diisi').max(200, 'Maksimal 200 karakter'),
  categoryId: z.string().min(1, 'Pilih kategori'),
  locationId: z.string().min(1, 'Pilih lokasi'),
  ownershipType: z.enum(OWNERSHIP_TYPES),
  acquisitionMethod: z.enum(ACQUISITION_METHODS),
  condition: z.enum(ASSET_CONDITIONS),
  status: z.enum(ASSET_STATUSES),
  brand: optionalText(100),
  model: optionalText(100),
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
  ownershipType: 'OFFICE',
  acquisitionMethod: 'PURCHASE',
  condition: 'GOOD',
  status: 'AVAILABLE',
  brand: '',
  model: '',
  serialNumber: '',
  description: '',
  vendor: '',
  notes: '',
  acquisitionDate: '',
  purchasePrice: '',
  departmentId: '',
  responsibleEmployeeId: '',
};

const textOrNull = (v: string | undefined): string | null => {
  const t = v?.trim() ?? '';
  return t ? t : null;
};

export function toAssetPayload(values: AssetFormValues): AssetInput {
  const price = values.purchasePrice.trim();
  return {
    name: values.name.trim(),
    categoryId: values.categoryId,
    locationId: values.locationId,
    ownershipType: values.ownershipType,
    acquisitionMethod: values.acquisitionMethod,
    condition: values.condition,
    status: values.status,
    brand: textOrNull(values.brand),
    model: textOrNull(values.model),
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

/** Edit payload: the locked fields (location, responsible, condition) are never sent. */
export function toAssetUpdatePayload(values: AssetFormValues): AssetUpdateInput {
  const payload: Partial<AssetInput> = toAssetPayload(values);
  delete payload.locationId;
  delete payload.responsibleEmployeeId;
  delete payload.condition;
  // A borrowed asset carries the loan-managed status in the form; sending it back would be refused.
  if (payload.status === 'BORROWED' || payload.status === 'RETURNED') delete payload.status;
  return payload;
}

export function fromAssetDetail(asset: AssetDetail): AssetFormValues {
  return {
    name: asset.name,
    categoryId: asset.category.id,
    locationId: asset.location.id,
    ownershipType: asset.ownershipType,
    acquisitionMethod: asset.acquisitionMethod,
    condition: asset.condition,
    status: asset.status,
    brand: asset.brand ?? '',
    model: asset.model ?? '',
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
