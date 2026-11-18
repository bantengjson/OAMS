import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus } from '../../../generated/prisma/client.js';

export class CountByRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() count!: number;
}

export class AssetStatisticsDto {
  @ApiProperty({ description: 'Barang tidak diarsipkan' }) total!: number;
  @ApiProperty() active!: number;
  @ApiProperty() archived!: number;
  @ApiProperty({ type: Object }) byStatus!: Record<AssetStatus, number>;
  @ApiProperty({ type: Object }) byCondition!: Record<AssetCondition, number>;
  @ApiProperty({ type: [CountByRefDto] }) byCategory!: CountByRefDto[];
  @ApiProperty({ type: [CountByRefDto], description: 'Dikelompokkan per Kantor (akar lokasi)' })
  byOffice!: CountByRefDto[];
}
