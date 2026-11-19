import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, Validate } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';
import { BorrowerType } from '../../../generated/prisma/client.js';
import { IsCalendarDate, emptyToNull, enumMessage } from '../../assets/dto/create-asset.dto.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLoanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Barang tidak valid' })
  assetId!: string;

  @ApiProperty({ enum: BorrowerType })
  @IsEnum(BorrowerType, { message: enumMessage('Jenis peminjam', BorrowerType) })
  borrowerType!: BorrowerType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Wajib bila EMPLOYEE' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Pegawai peminjam tidak valid' })
  borrowerEmployeeId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Wajib bila EXTERNAL; untuk EMPLOYEE diisi dari data pegawai' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150, { message: 'Nama peminjam maksimal 150 karakter' })
  borrowerName?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Unit kerja tidak valid' })
  borrowerDepartmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100, { message: 'Kontak maksimal 100 karakter' })
  borrowerContact?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Wajib bila EXTERNAL' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Penjamin tidak valid' })
  guarantorEmployeeId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Presentasi di kantor cabang' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Keperluan maksimal 2000 karakter' })
  purpose?: string | null;

  @ApiProperty({ example: '2026-11-19' })
  @Transform(trim)
  @IsString({ message: 'Tanggal pinjam wajib diisi' })
  @Matches(DATE, { message: 'Tanggal pinjam harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Tanggal pinjam tidak valid' })
  loanedAt!: string;

  @ApiProperty({ example: '2026-11-26' })
  @Transform(trim)
  @IsString({ message: 'Rencana kembali wajib diisi' })
  @Matches(DATE, { message: 'Rencana kembali harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Rencana kembali tidak valid' })
  dueAt!: string;
}

export class UpdateLoanDto {
  @ApiPropertyOptional({ example: '2026-12-03', description: 'Perpanjangan rencana kembali' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(DATE, { message: 'Rencana kembali harus berformat YYYY-MM-DD' })
  @Validate(IsCalendarDate, { message: 'Rencana kembali tidak valid' })
  dueAt?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000, { message: 'Keperluan maksimal 2000 karakter' })
  purpose?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100, { message: 'Kontak maksimal 100 karakter' })
  borrowerContact?: string | null;
}
