import { ApiProperty } from '@nestjs/swagger';
import type { AssetCondition, AssetStatus, BorrowerType, LoanStatus } from '../../../generated/prisma/client.js';

export class LoanAssetRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'INV-2026-0001' }) assetCode!: string;
  @ApiProperty() name!: string;
}

export class LoanEmployeeRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class LoanDepartmentRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class LoanUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
}

export class LoanDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['ACTIVE', 'RETURNED'] }) status!: LoanStatus;
  @ApiProperty({ type: LoanAssetRefDto }) asset!: LoanAssetRefDto;
  @ApiProperty({ enum: ['EMPLOYEE', 'EXTERNAL'] }) borrowerType!: BorrowerType;
  @ApiProperty({ type: LoanEmployeeRefDto, nullable: true }) borrowerEmployee!: LoanEmployeeRefDto | null;
  @ApiProperty() borrowerName!: string;
  @ApiProperty({ type: LoanDepartmentRefDto, nullable: true }) borrowerDepartment!: LoanDepartmentRefDto | null;
  @ApiProperty({ nullable: true }) borrowerContact!: string | null;
  @ApiProperty({ type: LoanEmployeeRefDto, nullable: true, description: 'Wajib untuk peminjam bukan karyawan' })
  guarantorEmployee!: LoanEmployeeRefDto | null;
  @ApiProperty({ nullable: true }) purpose!: string | null;
  @ApiProperty({ example: '2026-11-19' }) loanedAt!: string;
  @ApiProperty({ example: '2026-11-26' }) dueAt!: string;
  @ApiProperty({ nullable: true }) returnedAt!: Date | null;
  @ApiProperty({ nullable: true }) returnCondition!: AssetCondition | null;
  @ApiProperty({ nullable: true }) returnNotes!: string | null;
  @ApiProperty({ description: 'Status barang sebelum dipinjam; dipulihkan saat kembali' })
  previousStatus!: AssetStatus;
  @ApiProperty({ description: 'ACTIVE dan lewat rencana kembali (Asia/Jakarta)' }) isOverdue!: boolean;
  @ApiProperty() overdueDays!: number;
  @ApiProperty({ type: LoanUserRefDto }) recordedBy!: LoanUserRefDto;
  @ApiProperty({ type: LoanUserRefDto, nullable: true }) returnedBy!: LoanUserRefDto | null;
  @ApiProperty() createdAt!: Date;
}
