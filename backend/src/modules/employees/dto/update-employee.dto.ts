import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto.js';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto, { skipNullProperties: false }) {
  @ApiPropertyOptional({ description: 'false menonaktifkan pegawai tanpa melepas barang yang dipegang' })
  @IsOptional()
  @IsBoolean({ message: 'isActive harus true atau false' })
  isActive?: boolean;
}
