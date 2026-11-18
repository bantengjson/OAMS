import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QrInfoDto {
  @ApiProperty() token!: string;
  @ApiProperty({ description: 'Isi QR Code' }) url!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() generatedAt!: Date;
  @ApiProperty() printedCount!: number;
  @ApiProperty({ nullable: true }) lastPrintedAt!: Date | null;
}

export const QR_FORMATS = ['png', 'svg'] as const;
export type QrFormat = (typeof QR_FORMATS)[number];

export class QrDownloadQueryDto {
  @ApiPropertyOptional({ enum: QR_FORMATS, default: 'png' })
  @IsOptional()
  @IsIn(QR_FORMATS, { message: 'format harus png atau svg' })
  format: QrFormat = 'png';

  @ApiPropertyOptional({ default: 600, minimum: 300, maximum: 2000, description: 'Lebar piksel' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'size harus bilangan bulat' })
  @Min(300, { message: 'size minimal 300' })
  @Max(2000, { message: 'size maksimal 2000' })
  size: number = 600;
}

export class AssetIdsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray({ message: 'assetIds harus berupa daftar' })
  @ArrayMinSize(1, { message: 'Pilih minimal satu barang' })
  @ArrayMaxSize(500, { message: 'Maksimal 500 barang sekali proses' })
  @IsUUID('all', { each: true, message: 'ID barang tidak valid' })
  assetIds!: string[];
}

export class BulkQrItemDto {
  @ApiProperty() assetId!: string;
  @ApiProperty() assetCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() token!: string;
  @ApiProperty() url!: string;
}

export class BulkQrSkippedDto {
  @ApiProperty() assetId!: string;
  @ApiProperty() reason!: string;
}

export class BulkQrResultDto {
  @ApiProperty({ type: [BulkQrItemDto] }) items!: BulkQrItemDto[];
  @ApiProperty({ type: [BulkQrSkippedDto] }) skipped!: BulkQrSkippedDto[];
}

export class MarkPrintedResultDto {
  @ApiProperty() updated!: number;
}
