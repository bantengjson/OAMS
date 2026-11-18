import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLower } from '../../../common/dto/transforms.js';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Email atau username' })
  @Transform(trimLower)
  @IsString({ message: 'Email atau username wajib diisi' })
  @IsNotEmpty({ message: 'Email atau username wajib diisi' })
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ example: 'Rahasia123' })
  @IsString({ message: 'Password wajib diisi' })
  @IsNotEmpty({ message: 'Password wajib diisi' })
  password!: string;
}
