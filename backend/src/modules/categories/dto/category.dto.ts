import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MasterDataQueryDto } from '../../../common/dto/master-data-query.dto.js';
import { toBoolean, trim } from '../../../common/dto/transforms.js';

export const GOLONGAN = ['BG', 'NG'] as const;
export type Golongan = (typeof GOLONGAN)[number];
const GOLONGAN_MESSAGE = 'Golongan harus BG atau NG';
const NUMBER_MESSAGE = 'Nomor jenis harus angka 1-999';

/** Item type ("Jenis Barang"); the API path stays /categories. */
export class CategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'NG-012' }) code!: string;
  @ApiProperty({ enum: GOLONGAN }) golongan!: Golongan;
  @ApiProperty({ example: 12 }) number!: number;
  @ApiProperty({ description: 'Jenis untuk Barang Kelompok (dihitung, tanpa QR)' }) isGroup!: boolean;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'NG 012 · Kursi Merah' }) label!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Sudah dipakai barang; golongan, nomor, dan jenis kelompok terkunci' }) inUse!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CategoryQueryDto extends MasterDataQueryDto {
  @ApiPropertyOptional({ enum: GOLONGAN })
  @IsOptional()
  @IsIn(GOLONGAN, { message: GOLONGAN_MESSAGE })
  golongan?: Golongan;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isGroup harus true atau false' })
  isGroup?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ enum: GOLONGAN })
  @IsIn(GOLONGAN, { message: GOLONGAN_MESSAGE })
  golongan!: Golongan;

  @ApiPropertyOptional({ description: 'Kosongkan untuk nomor berikutnya di golongan ini' })
  @IsOptional()
  @IsInt({ message: NUMBER_MESSAGE })
  @Min(1, { message: NUMBER_MESSAGE })
  @Max(999, { message: NUMBER_MESSAGE })
  number?: number;

  @ApiProperty({ example: 'Kursi Merah' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'isGroup harus true atau false' })
  isGroup?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ enum: GOLONGAN })
  @IsOptional()
  @IsIn(GOLONGAN, { message: GOLONGAN_MESSAGE })
  golongan?: Golongan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt({ message: NUMBER_MESSAGE })
  @Min(1, { message: NUMBER_MESSAGE })
  @Max(999, { message: NUMBER_MESSAGE })
  number?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Nama harus berupa teks' })
  @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'isGroup harus true atau false' })
  isGroup?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
