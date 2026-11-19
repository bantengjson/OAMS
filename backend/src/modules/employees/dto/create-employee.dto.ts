import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../../common/dto/transforms.js';

/** `''` becomes `null` so optional text columns can be cleared from a form. */
const emptyToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(150, { message: 'Nama maksimal 150 karakter' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'PEG-001', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(30, { message: 'Nomor pegawai maksimal 30 karakter' })
  employeeNumber?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Unit kerja tidak valid' })
  departmentId?: string | null;

  @ApiPropertyOptional({ example: 'Staf Keuangan', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  position?: string | null;

  @ApiPropertyOptional({ example: '081234567890', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(30, { message: 'Kontak maksimal 30 karakter' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'budi@kantor.go.id', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Akun login yang ditautkan' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Akun tidak valid' })
  userId?: string | null;
}
