import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { toBoolean } from '../../../common/dto/transforms.js';
import { AssetCondition, AssetStatus, OwnershipType } from '../../../generated/prisma/client.js';

export const ASSET_SORT_FIELDS = ['name', 'assetCode', 'updatedAt', 'createdAt'] as const;
export type AssetSortField = (typeof ASSET_SORT_FIELDS)[number];

export class AssetQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari pada kode, nama, spesifikasi, nomor seri' })
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all')
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['BG', 'NG'] }) @IsOptional() @IsIn(['BG', 'NG'])
  golongan?: 'BG' | 'NG';

  @ApiPropertyOptional({ format: 'uuid', description: 'Termasuk semua lokasi turunannya' })
  @IsOptional() @IsUUID('all')
  locationId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all')
  departmentId?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('all')
  responsibleEmployeeId?: string;

  @ApiPropertyOptional({ enum: AssetCondition }) @IsOptional() @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @ApiPropertyOptional({ enum: AssetStatus }) @IsOptional() @IsEnum(AssetStatus)
  status?: AssetStatus;

  @ApiPropertyOptional({ enum: OwnershipType }) @IsOptional() @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @Transform(toBoolean) @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ enum: ASSET_SORT_FIELDS, default: 'createdAt' })
  @IsOptional() @IsIn(ASSET_SORT_FIELDS)
  sort: AssetSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional() @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
