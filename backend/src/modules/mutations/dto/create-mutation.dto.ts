import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { toBoolean, trim } from '../../../common/dto/transforms.js';
import { emptyToNull } from '../../assets/dto/create-asset.dto.js';

export class CreateMutationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Barang tidak valid' })
  assetId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Kosong = lokasi tidak berubah' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Lokasi tujuan tidak valid' })
  toLocationId?: string | null;

  @ApiPropertyOptional({ default: false, description: 'true = penanggung jawab diganti (boleh ke kosong)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'changesResponsible harus true atau false' })
  changesResponsible?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Berlaku bila changesResponsible; null = dilepas' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUUID('all', { message: 'Penanggung jawab tujuan tidak valid' })
  toResponsibleEmployeeId?: string | null;

  @ApiProperty({ example: 'Pindah ke ruang rapat lantai 1' })
  @Transform(trim)
  @IsString({ message: 'Alasan wajib diisi' })
  @IsNotEmpty({ message: 'Alasan wajib diisi' })
  @MaxLength(2000, { message: 'Alasan maksimal 2000 karakter' })
  reason!: string;
}
