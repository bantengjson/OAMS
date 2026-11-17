import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { PermissionGroupDto, RoleDto } from './dto/role.dto.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles')
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'Daftar role beserta permission' })
  @ApiOkResponse({ type: [RoleDto] })
  list(): Promise<RoleDto[]> {
    return this.roles.list();
  }

  @Get('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'Detail role' })
  @ApiOkResponse({ type: RoleDto })
  get(@Param('id', ParseUuid) id: string): Promise<RoleDto> {
    return this.roles.get(id);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_VIEW)
  @ApiOperation({ summary: 'Katalog permission dikelompokkan per modul' })
  @ApiOkResponse({ type: [PermissionGroupDto] })
  permissions(): PermissionGroupDto[] {
    return this.roles.listPermissions();
  }

  @Put('roles/:id/permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Ganti seluruh permission sebuah role' })
  @ApiOkResponse({ type: RoleDto })
  setPermissions(
    @Param('id', ParseUuid) id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<RoleDto> {
    return this.roles.setPermissions(id, dto.permissions);
  }
}
