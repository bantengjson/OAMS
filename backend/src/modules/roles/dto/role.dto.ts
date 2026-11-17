import { ApiProperty } from '@nestjs/swagger';

export class RoleDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'ADMIN_INVENTARIS' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty() userCount!: number;
}

export class PermissionGroupItemDto {
  @ApiProperty() code!: string;
  @ApiProperty() description!: string;
}

export class PermissionGroupDto {
  @ApiProperty() module!: string;
  @ApiProperty({ type: [PermissionGroupItemDto] }) permissions!: PermissionGroupItemDto[];
}
