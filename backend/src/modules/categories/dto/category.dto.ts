import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCode } from '../../../common/dto/code.validators.js';
import { trim } from '../../../common/dto/transforms.js';

export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'KOMPUTER_IT' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'PRINTER', description: 'Huruf besar, angka, garis bawah; 2-20 karakter' })
  @IsCode()
  code!: string;

  @ApiProperty({ example: 'Printer' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsCode()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Nama harus berupa teks' })
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
