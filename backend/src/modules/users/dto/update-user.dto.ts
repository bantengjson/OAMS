import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ nullable: true, description: 'Kosongkan (null) untuk menghapus username' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9._-]{3,50}$/, {
    message: 'Username 3-50 karakter: huruf kecil, angka, titik, garis bawah, atau strip',
  })
  username?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nama lengkap harus berupa teks' })
  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: 'departmentId tidak valid' })
  departmentId?: string | null;
}
