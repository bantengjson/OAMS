import { ApiProperty } from '@nestjs/swagger';

export class EmployeeDepartmentRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class EmployeeUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
}

export class EmployeeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, example: 'PEG-001' }) employeeNumber!: string | null;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: EmployeeDepartmentRefDto, nullable: true }) department!: EmployeeDepartmentRefDto | null;
  @ApiProperty({ nullable: true }) position!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ type: EmployeeUserRefDto, nullable: true, description: 'Akun login yang tertaut' })
  user!: EmployeeUserRefDto | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class EmployeeDetailDto extends EmployeeDto {
  @ApiProperty({ description: 'Barang aktif yang dipegang' }) assetCount!: number;
  @ApiProperty({ description: 'Pinjaman aktif sebagai peminjam' }) activeLoanCount!: number;
}

export class EmployeeLookupDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) employeeNumber!: string | null;
  @ApiProperty({ nullable: true }) department!: { id: string; name: string } | null;
}
