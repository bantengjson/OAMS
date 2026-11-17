import { ApiProperty } from '@nestjs/swagger';

export class UserDepartmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class UserRoleDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: UserDepartmentDto, nullable: true }) department!: UserDepartmentDto | null;
  @ApiProperty({ type: [UserRoleDto] }) roles!: UserRoleDto[];
  @ApiProperty({ nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
