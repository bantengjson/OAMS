import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLogDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { ParseUuid } from '../../common/pipes/uuid.pipe.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetUserRolesDto } from './dto/set-user-roles.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserDto } from './dto/user.dto.js';
import { UserQueryDto } from './dto/user-query.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.USERS_MANAGE)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pengguna' })
  list(@Query() q: UserQueryDto): Promise<Paginated<UserDto>> {
    return this.users.list(q);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah pengguna' })
  @ApiCreatedResponse({ type: UserDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser): Promise<UserDto> {
    return this.users.create(dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pengguna' })
  @ApiOkResponse({ type: UserDto })
  get(@Param('id', ParseUuid) id: string): Promise<UserDto> {
    return this.users.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah data pengguna' })
  @ApiOkResponse({ type: UserDto })
  update(@Param('id', ParseUuid) id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.users.update(id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Nonaktifkan pengguna (mencabut semua sesi)' })
  @ApiOkResponse({ type: UserDto })
  deactivate(@Param('id', ParseUuid) id: string, @CurrentUser() actor: AuthUser): Promise<UserDto> {
    return this.users.deactivate(id, actor);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aktifkan kembali pengguna' })
  @ApiOkResponse({ type: UserDto })
  activate(@Param('id', ParseUuid) id: string): Promise<UserDto> {
    return this.users.activate(id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password pengguna (mencabut semua sesi)' })
  async resetPassword(
    @Param('id', ParseUuid) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.users.resetPassword(id, dto.newPassword);
  }

  @Put(':id/roles')
  @ApiOperation({ summary: 'Ganti seluruh role pengguna' })
  @ApiOkResponse({ type: UserDto })
  setRoles(
    @Param('id', ParseUuid) id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return this.users.setRoles(id, dto.roleCodes, actor);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Riwayat aktivitas pengguna (audit log sebagai pelaku)' })
  activity(
    @Param('id', ParseUuid) id: string,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<AuditLogDto>> {
    return this.users.activity(id, q);
  }
}
