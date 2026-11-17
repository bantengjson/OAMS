import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Minimal 8 karakter, mengandung huruf dan angka' })
  @IsString({ message: 'Password baru wajib diisi' })
  @IsNotEmpty({ message: 'Password baru wajib diisi' })
  newPassword!: string;
}
