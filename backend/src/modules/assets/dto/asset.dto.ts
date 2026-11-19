import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  AcquisitionMethod,
  AssetCondition,
  AssetStatus,
  LocationType,
  OwnershipType,
} from '../../../generated/prisma/client.js';

export class AssetCategoryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class AssetLocationRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() type!: LocationType;
  @ApiProperty({ example: 'Kantor Pusat / Gedung A / Lantai 2 / Ruang 201' }) path!: string;
}

export class AssetDepartmentRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class AssetUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class AssetEmployeeDepartmentRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class AssetEmployeeRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: AssetEmployeeDepartmentRefDto, nullable: true })
  department!: AssetEmployeeDepartmentRefDto | null;
}

export class AssetPhotoDto {
  @ApiProperty() id!: string;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ nullable: true }) caption!: string | null;
  @ApiProperty({ nullable: true }) width!: number | null;
  @ApiProperty({ nullable: true }) height!: number | null;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ description: 'Path API relatif untuk mengambil berkas' })
  urls!: { full: string; thumb: string };
}

export class AssetDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true }) title!: string | null;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() url!: string;
}

export class AssetLabelSummaryDto {
  @ApiProperty() token!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Isi QR Code' }) url!: string;
  @ApiProperty() printedCount!: number;
  @ApiProperty({ nullable: true }) lastPrintedAt!: Date | null;
  @ApiProperty() generatedAt!: Date;
}

export class AssetListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'INV-2026-0001' }) assetCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: AssetCategoryRefDto }) category!: AssetCategoryRefDto;
  @ApiProperty({ type: AssetLocationRefDto }) location!: AssetLocationRefDto;
  @ApiProperty({ type: AssetDepartmentRefDto, nullable: true }) department!: AssetDepartmentRefDto | null;
  @ApiProperty({ type: AssetEmployeeRefDto, nullable: true }) responsibleEmployee!: AssetEmployeeRefDto | null;
  @ApiProperty({ nullable: true }) brand!: string | null;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty() condition!: AssetCondition;
  @ApiProperty() status!: AssetStatus;
  @ApiProperty() ownershipType!: OwnershipType;
  @ApiProperty() hasPhoto!: boolean;
  @ApiProperty() isArchived!: boolean;
  @ApiProperty() updatedAt!: Date;
}

export class AssetDetailDto extends AssetListItemDto {
  @ApiProperty({ nullable: true }) serialNumber!: string | null;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() acquisitionMethod!: AcquisitionMethod;
  @ApiPropertyOptional({ nullable: true, example: '2026-01-15' }) acquisitionDate!: string | null;
  @ApiPropertyOptional({ nullable: true, example: '15000000.00' }) purchasePrice!: string | null;
  @ApiProperty({ nullable: true }) vendor!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ nullable: true }) archivedAt!: Date | null;
  @ApiProperty({ nullable: true }) archiveReason!: string | null;
  @ApiProperty({ type: AssetUserRefDto, nullable: true }) archivedBy!: AssetUserRefDto | null;
  @ApiProperty({ type: AssetUserRefDto, nullable: true }) createdBy!: AssetUserRefDto | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [AssetPhotoDto] }) photos!: AssetPhotoDto[];
  @ApiProperty({ type: [AssetDocumentDto] }) documents!: AssetDocumentDto[];
  @ApiProperty({ type: AssetLabelSummaryDto, nullable: true }) label!: AssetLabelSummaryDto | null;
}
