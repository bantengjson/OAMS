import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus } from '../../../generated/prisma/client.js';

/** What an anonymous visitor sees after scanning a QR code. */
export class PublicAssetDto {
  @ApiProperty({ example: 'INV-2026-0001' }) assetCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: { name: string };
  @ApiProperty({ nullable: true }) brand!: string | null;
  @ApiProperty({ nullable: true }) model!: string | null;
  @ApiProperty() location!: { name: string; path: string };
  @ApiProperty() status!: AssetStatus;
  @ApiProperty() condition!: AssetCondition;
  @ApiProperty() hasPhoto!: boolean;
}
