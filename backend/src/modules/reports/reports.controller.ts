import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { Response } from 'express';
import { jakartaToday } from '../../common/dates/jakarta.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { OFFICE_NAME } from '../../common/office.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { jakartaYear } from '../assets/asset-code.js';
import { buildReportSections } from './inventory-report.js';
import type { ReportGroup, ReportMode, ReportUnit } from './inventory-report.js';
import { renderInventoryXlsx } from './inventory-xlsx.js';

export class InventoryReportQueryDto {
  @ApiPropertyOptional({ enum: ['per-room', 'overall'], default: 'per-room' })
  @IsIn(['per-room', 'overall'], { message: 'Mode laporan harus per-room atau overall' })
  mode: ReportMode = 'per-room';
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('inventory')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Unduh Daftar Inventaris (format Excel kantor)' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async inventory(@Query() q: InventoryReportQueryDto, @Res() res: Response): Promise<void> {
    const [assets, groups] = await Promise.all([
      // Archived records are out of the register; released ones stay with Keterangan "Tidak Ada".
      this.prisma.asset.findMany({
        where: { archivedAt: null },
        select: {
          acquisitionYear: true,
          specification: true,
          condition: true,
          status: true,
          source: true,
          category: { select: { golongan: true, number: true, name: true } },
          location: { select: { code: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.groupItem.findMany({
        where: { archivedAt: null },
        select: {
          acquisitionYear: true,
          specification: true,
          source: true,
          qtyGood: true,
          qtyNeedsRepair: true,
          qtyDamaged: true,
          category: { select: { golongan: true, number: true, name: true } },
          location: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const units: ReportUnit[] = assets.map((a) => {
      const room = a.location?.type === 'ROOM' ? a.location : null;
      return {
        golongan: a.category.golongan,
        typeNumber: a.category.number,
        typeName: a.category.name,
        roomCode: room?.code ?? null,
        roomName: room?.name ?? null,
        year: a.acquisitionYear,
        specification: a.specification,
        condition: a.condition,
        present: a.status !== 'DISPOSED',
        source: a.source,
      };
    });
    const rows: ReportGroup[] = groups.map((g) => ({
      golongan: g.category.golongan,
      typeNumber: g.category.number,
      typeName: g.category.name,
      roomCode: g.location.code,
      roomName: g.location.name,
      year: g.acquisitionYear,
      specification: g.specification,
      source: g.source,
      good: g.qtyGood,
      needsRepair: g.qtyNeedsRepair,
      damaged: g.qtyDamaged,
    }));
    const body = await renderInventoryXlsx(buildReportSections(units, rows, q.mode), {
      officeName: OFFICE_NAME,
      year: jakartaYear(),
    });
    const fileName = `Daftar Inventaris DPC ${jakartaToday()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(body);
  }
}
