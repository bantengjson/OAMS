import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { toBoolean, trim } from '../../../common/dto/transforms.js';

export class RoomDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'A', description: 'Huruf ruangan; tidak bisa diubah' }) code!: string;
  @ApiProperty({ example: 'Sekretariat' }) name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Sudah dipakai barang' }) inUse!: boolean;
}

export class RoomQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive harus true atau false' })
  isActive?: boolean;
}

export class SaveRoomDto {
  @ApiProperty({ example: 'Ruang Arsip' })
  @Transform(trim)
  @IsString({ message: 'Nama ruangan wajib diisi' })
  @IsNotEmpty({ message: 'Nama ruangan wajib diisi' })
  @MaxLength(150)
  name!: string;
}
