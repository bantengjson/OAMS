import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCode } from '../../../common/dto/code.validators.js';
import { trim } from '../../../common/dto/transforms.js';

export class DepartmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'KEU' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'KEU', description: 'Huruf besar, angka, garis bawah; 2-20 karakter' })
  @IsCode()
  code!: string;

  @ApiProperty({ example: 'Keuangan' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(150)
  name!: string;
}

export class UpdateDepartmentDto {
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
}
