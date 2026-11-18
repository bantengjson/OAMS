import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { toBoolean } from '../../../common/dto/transforms.js';

export class UserLookupQueryDto {
  @ApiPropertyOptional({ description: 'Cari pada nama, email, atau username' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cari pada nama atau email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isActive harus true atau false' })
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'PETUGAS_INVENTARIS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  roleCode?: string;
}
