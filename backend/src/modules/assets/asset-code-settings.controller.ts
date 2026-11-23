import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { AuditService } from '../../common/audit/audit.service.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { ASSET_CODE_ORG_KEY } from '../../common/office.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AssetCodeService, normalizeOrg, ORG_INVALID } from './asset-code.js';

export class AssetCodeOrgDto {
  @ApiProperty({ example: 'DPC', description: 'Bagian organisasi di kode barang' })
  @IsString({ message: ORG_INVALID })
  @MaxLength(50, { message: ORG_INVALID })
  value!: string;
}

/** The "DPC" part of asset codes; a change applies to new codes only. */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings/asset-code-org')
export class AssetCodeSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: AssetCodeService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Kode organisasi di kode barang' })
  async get(): Promise<AssetCodeOrgDto> {
    return { value: await this.codes.org(this.prisma) };
  }

  @Put()
  @RequirePermissions(PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Ubah kode organisasi (berlaku untuk kode baru)' })
  async set(@Body() dto: AssetCodeOrgDto): Promise<AssetCodeOrgDto> {
    const value = normalizeOrg(dto.value);
    if (!value) throw new BadRequestException(ORG_INVALID);
    const before = await this.codes.org(this.prisma);
    await this.prisma.systemSetting.upsert({
      where: { key: ASSET_CODE_ORG_KEY },
      update: { value },
      create: { key: ASSET_CODE_ORG_KEY, value },
    });
    await this.audit.record({
      action: 'setting.asset_code_org_changed',
      module: 'settings',
      before: { value: before },
      after: { value },
    });
    return { value };
  }
}
