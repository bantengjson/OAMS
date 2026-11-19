import { ApiProperty } from '@nestjs/swagger';
import type { MutationStatus } from '../../../generated/prisma/client.js';

export class MutationAssetRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'INV-2026-0001' }) assetCode!: string;
  @ApiProperty() name!: string;
}

export class MutationLocationRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'Kantor Pusat / Gedung A / Lantai 2 / Ruang 201' }) path!: string;
}

export class MutationEmployeeRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class MutationUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class MutationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] }) status!: MutationStatus;
  @ApiProperty({ type: MutationAssetRefDto }) asset!: MutationAssetRefDto;
  @ApiProperty({ type: MutationLocationRefDto, nullable: true }) fromLocation!: MutationLocationRefDto | null;
  @ApiProperty({ type: MutationLocationRefDto, nullable: true }) toLocation!: MutationLocationRefDto | null;
  @ApiProperty() changesResponsible!: boolean;
  @ApiProperty({ type: MutationEmployeeRefDto, nullable: true })
  fromResponsibleEmployee!: MutationEmployeeRefDto | null;
  @ApiProperty({ type: MutationEmployeeRefDto, nullable: true })
  toResponsibleEmployee!: MutationEmployeeRefDto | null;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: MutationUserRefDto }) requestedBy!: MutationUserRefDto;
  @ApiProperty() requestedAt!: Date;
  @ApiProperty({ type: MutationUserRefDto, nullable: true }) decidedBy!: MutationUserRefDto | null;
  @ApiProperty({ nullable: true }) decidedAt!: Date | null;
  @ApiProperty({ nullable: true }) decisionNote!: string | null;
  @ApiProperty({ nullable: true }) cancelledAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}
