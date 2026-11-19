import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, ConditionSource } from '../../../generated/prisma/client.js';
import { AssetPhotoDto, AssetUserRefDto } from './asset.dto.js';

export class ConditionLogDto {
  @ApiProperty() id!: string;
  @ApiProperty() condition!: AssetCondition;
  @ApiProperty({ nullable: true }) previousCondition!: AssetCondition | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ example: '2026-11-19' }) checkedAt!: string;
  @ApiProperty() source!: ConditionSource;
  @ApiProperty({ nullable: true }) loanId!: string | null;
  @ApiProperty({ type: AssetUserRefDto }) checkedBy!: AssetUserRefDto;
  @ApiProperty({ type: [AssetPhotoDto] }) photos!: AssetPhotoDto[];
  @ApiProperty() createdAt!: Date;
}
