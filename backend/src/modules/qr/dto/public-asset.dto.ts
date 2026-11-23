import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus } from '../../../generated/prisma/client.js';

/** What an anonymous visitor sees after scanning a QR code. */
export class PublicAssetDto {
  @ApiProperty({ example: 'INV-2026-0001' }) assetCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: { name: string };
  @ApiProperty({ nullable: true, description: 'Merk/Type/Warna' }) specification!: string | null;
  @ApiProperty({ nullable: true, description: 'Ruangan saat ini' }) room!: { code: string; name: string } | null;
  @ApiProperty() status!: AssetStatus;
  @ApiProperty() condition!: AssetCondition;
  @ApiProperty() hasPhoto!: boolean;
}
