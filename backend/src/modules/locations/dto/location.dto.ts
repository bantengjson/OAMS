import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsCode } from '../../../common/dto/code.validators.js';
import { MasterDataQueryDto } from '../../../common/dto/master-data-query.dto.js';
import { toBoolean, trim } from '../../../common/dto/transforms.js';
import type { LocationType } from '../../../generated/prisma/client.js';
import { LOCATION_TYPES } from '../locations.rules.js';

const TYPE_MESSAGE = `Tipe lokasi harus salah satu dari: ${LOCATION_TYPES.join(', ')}`;

export class LocationParentDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: LOCATION_TYPES }) type!: LocationType;
}

export class LocationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GA_L2_201' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: LOCATION_TYPES }) type!: LocationType;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: LocationParentDto, nullable: true }) parent!: LocationParentDto | null;
  @ApiProperty({ example: 'Kantor Pusat / Gedung A / Lantai 2 / Ruang 201' }) path!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class LocationTreeNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: LOCATION_TYPES }) type!: LocationType;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => [LocationTreeNodeDto] }) children!: LocationTreeNodeDto[];
}

export class CreateLocationDto {
  @ApiProperty({ example: 'GA_L2_201' })
  @IsCode()
  code!: string;

  @ApiProperty({ example: 'Ruang 201' })
  @Transform(trim)
  @IsString({ message: 'Nama wajib diisi' })
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: LOCATION_TYPES })
  @IsIn(LOCATION_TYPES, { message: TYPE_MESSAGE })
  type!: LocationType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Wajib kecuali untuk tipe OFFICE' })
  @IsOptional()
  @IsUUID('all', { message: 'parentId tidak valid' })
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class UpdateLocationDto {
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

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: 'parentId tidak valid' })
  parentId?: string | null;
}

export class LocationQueryDto extends MasterDataQueryDto {
  @ApiPropertyOptional({ enum: LOCATION_TYPES })
  @IsOptional()
  @IsIn(LOCATION_TYPES, { message: TYPE_MESSAGE })
  type?: LocationType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'parentId tidak valid' })
  parentId?: string;
}

export class LocationTreeQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'includeInactive harus true atau false' })
  includeInactive?: boolean;
}
