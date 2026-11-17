import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['dashboard.view', 'assets.view'] })
  @IsArray({ message: 'permissions harus berupa daftar kode' })
  @IsString({ each: true, message: 'Setiap kode permission harus berupa teks' })
  permissions!: string[];
}
