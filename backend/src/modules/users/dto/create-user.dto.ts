import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'budi@kantor.local' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama lengkap wajib diisi' })
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({ description: 'Minimal 8 karakter, mengandung huruf dan angka' })
  @IsString({ message: 'Password wajib diisi' })
  @IsNotEmpty({ message: 'Password wajib diisi' })
  password!: string;

  @ApiProperty({ type: [String], example: ['PETUGAS_INVENTARIS'] })
  @IsArray({ message: 'roleCodes harus berupa daftar' })
  @ArrayMinSize(1, { message: 'Minimal satu role harus dipilih' })
  @IsString({ each: true, message: 'Kode role harus berupa teks' })
  roleCodes!: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId tidak valid' })
  departmentId?: string | null;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
