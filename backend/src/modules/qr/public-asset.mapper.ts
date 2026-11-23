import type { AssetCondition, AssetStatus } from '../../generated/prisma/client.js';
import type { PublicAssetDto } from './dto/public-asset.dto.js';

/** Structural subset of AssetDetailDto the mapper reads; extra keys are ignored. */
export interface PublicAssetSource {
  assetCode: string;
  name: string;
  specification: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  category: { name: string };
  room: { code: string; name: string } | null;
  photos: { id: string }[];
}

/** The complete list of keys an anonymous visitor may receive. Nothing else. */
export const PUBLIC_ASSET_KEYS = [
  'assetCode',
  'name',
  'category',
  'specification',
  'room',
  'status',
  'condition',
  'hasPhoto',
] as const;

export function toPublicAsset(source: PublicAssetSource): PublicAssetDto {
  return {
    assetCode: source.assetCode,
    name: source.name,
    category: { name: source.category.name },
    specification: source.specification,
    room: source.room ? { code: source.room.code, name: source.room.name } : null,
    status: source.status,
    condition: source.condition,
    hasPhoto: source.photos.length > 0,
  };
}
