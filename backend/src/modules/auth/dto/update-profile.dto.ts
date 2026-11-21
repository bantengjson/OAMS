import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Self-service profile edit: only the display name (username and email stay with Super Admin). */
export class UpdateProfileDto {
  @ApiProperty({ example: 'Budi Santoso', description: 'Nama tampilan, 2-150 karakter' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString({ message: 'Nama harus berupa teks' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MinLength(2, { message: 'Nama minimal 2 karakter' })
  @MaxLength(150, { message: 'Nama maksimal 150 karakter' })
  fullName!: string;
}
