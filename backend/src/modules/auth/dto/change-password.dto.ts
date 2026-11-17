import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Password saat ini wajib diisi' })
  @IsNotEmpty({ message: 'Password saat ini wajib diisi' })
  currentPassword!: string;

  @ApiProperty({ description: 'Minimal 8 karakter, mengandung huruf dan angka' })
  @IsString({ message: 'Password baru wajib diisi' })
  @IsNotEmpty({ message: 'Password baru wajib diisi' })
  newPassword!: string;
}
