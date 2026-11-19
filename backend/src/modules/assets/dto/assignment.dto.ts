import { ApiProperty } from '@nestjs/swagger';
import type { AssignmentSource } from '../../../generated/prisma/client.js';
import { AssetUserRefDto } from './asset.dto.js';

export class AssignmentEmployeeRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class AssignmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: AssignmentEmployeeRefDto, nullable: true }) fromEmployee!: AssignmentEmployeeRefDto | null;
  @ApiProperty({ type: AssignmentEmployeeRefDto, nullable: true }) toEmployee!: AssignmentEmployeeRefDto | null;
  @ApiProperty() source!: AssignmentSource;
  @ApiProperty({ nullable: true }) mutationId!: string | null;
  @ApiProperty({ nullable: true }) note!: string | null;
  @ApiProperty({ type: AssetUserRefDto }) changedBy!: AssetUserRefDto;
  @ApiProperty() createdAt!: Date;
}
