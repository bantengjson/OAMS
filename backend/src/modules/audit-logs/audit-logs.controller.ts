import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit/audit.service.js';
import { RESTRICTED_AUDIT_MODULES } from '../../common/audit/audit.types.js';
import type { AuditLogDto } from '../../common/audit/audit.types.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { FORBIDDEN_MESSAGE } from '../../common/auth/permissions.guard.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { AuditLogQueryDto } from './dto/audit-log-query.dto.js';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  /**
   * `audit_logs.view_all` sees everything; `audit_logs.view_operational`
   * sees every module except auth, users, roles and settings. The scope is
   * decided here, not by `@RequirePermissions`, because either permission
   * suffices.
   */
  @Get()
  @ApiOperation({ summary: 'Daftar audit log (cakupan sesuai permission)' })
  list(
    @Query() q: AuditLogQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Paginated<AuditLogDto>> {
    const held = new Set(user.permissions);
    let excludeModules: string[] | undefined;
    if (held.has(PERMISSIONS.AUDIT_LOGS_VIEW_ALL)) {
      excludeModules = undefined;
    } else if (held.has(PERMISSIONS.AUDIT_LOGS_VIEW_OPERATIONAL)) {
      excludeModules = [...RESTRICTED_AUDIT_MODULES];
    } else {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return this.audit.list({
      page: q.page,
      pageSize: q.pageSize,
      actorId: q.actorId,
      module: q.module,
      action: q.action,
      entityId: q.entityId,
      from: q.from,
      to: q.to,
      excludeModules,
    });
  }
}
