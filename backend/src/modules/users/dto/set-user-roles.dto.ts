import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SetUserRolesDto {
  @ApiProperty({ type: [String], example: ['ADMIN_INVENTARIS'] })
  @IsArray({ message: 'roleCodes harus berupa daftar' })
  @ArrayMinSize(1, { message: 'Minimal satu role harus dipilih' })
  @IsString({ each: true, message: 'Kode role harus berupa teks' })
  roleCodes!: string[];
}
