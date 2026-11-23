import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PERMISSIONS } from '../../common/auth/permissions.catalog.js';
import { FORBIDDEN_MESSAGE } from '../../common/auth/permissions.guard.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs, type PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { isUniqueViolation } from '../../common/prisma/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { OpnameResult, Prisma } from '../../generated/prisma/client.js';
import { AssetCodeService, codePrefix } from '../assets/asset-code.js';
import { AssetConditionsService } from '../assets/asset-conditions.service.js';
import {
  REPORT_RESULTS,
  type ConfirmItemDto,
  type CountGroupLineDto,
  type CreateStockOpnameDto,
  type OpnameGroupLineDto,
  type OpnameItemDto,
  type OpnameItemQueryDto,
  type OpnameReportDto,
  type ReportResult,
  type ScanResultDto,
  type StockOpnameDto,
} from './dto/stock-opname.dto.js';
import { parseScanValue } from './scan-value.js';
import { emptyCounts, itemInclude, opnameInclude, toItemDto, toOpnameDto } from './stock-opnames.mapper.js';
import type { ItemRow, OpnameRow } from './stock-opnames.mapper.js';

export const OPNAME_NOT_FOUND = 'Sesi stock opname tidak ditemukan.';
export const OPNAME_ITEM_NOT_FOUND = 'Baris stock opname tidak ditemukan.';
export const OPNAME_OPEN_EXISTS = 'Masih ada sesi stock opname yang terbuka.';
export const OPNAME_NOT_OPEN = 'Sesi stock opname sudah ditutup.';
export const OPNAME_NOT_OFFICER = 'Anda bukan petugas sesi ini.';
const MODULE = 'stock_opnames';
const ONE_OPEN_INDEX = 'stock_opnames_one_open';

function validation(field: string, message: string): BadRequestException {
  return new BadRequestException({ message: 'Validasi gagal.', errors: { [field]: [message] } });
}

@Injectable()
export class StockOpnamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly conditions: AssetConditionsService,
    private readonly codes: AssetCodeService,
  ) {}

  // ---------------------------------------------------------------- reads

  async list(q: PaginationQueryDto, actor: AuthUser): Promise<Paginated<StockOpnameDto>> {
    this.assertCanView(actor);
    const [rows, total] = await Promise.all([
      this.prisma.stockOpname.findMany({
        include: opnameInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.stockOpname.count(),
    ]);
    const counts = await this.countsFor(rows.map((r) => r.id));
    return paginate(
      rows.map((r) => toOpnameDto(r, counts.get(r.id) ?? emptyCounts())),
      total,
      q,
    );
  }

  async get(id: string, actor: AuthUser): Promise<StockOpnameDto> {
    this.assertCanView(actor);
    return this.toDto(await this.getRow(id));
  }

  async items(id: string, q: OpnameItemQueryDto, actor: AuthUser): Promise<Paginated<OpnameItemDto>> {
    this.assertCanView(actor);
    await this.getRow(id);
    const where: Prisma.StockOpnameItemWhereInput = { opnameId: id };
    if (q.result) where.result = q.result;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ asset: { assetCode: contains } }, { asset: { name: contains } }, { rawValue: contains }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.stockOpnameItem.findMany({
        where,
        include: itemInclude,
        orderBy: [{ scannedAt: { sort: 'desc', nulls: 'last' } }, { asset: { assetCode: 'asc' } }, { id: 'asc' }],
        ...pageArgs(q),
      }),
      this.prisma.stockOpnameItem.count({ where }),
    ]);
    return paginate(rows.map(toItemDto), total, q);
  }

  async report(id: string, actor: AuthUser): Promise<OpnameReportDto> {
    this.assertCanView(actor);
    const session = await this.toDto(await this.getRow(id));
    const rows = await this.prisma.stockOpnameItem.findMany({
      where: { opnameId: id, result: { in: [...REPORT_RESULTS] } },
      include: itemInclude,
      orderBy: [{ asset: { assetCode: 'asc' } }, { createdAt: 'asc' }],
    });
    const groups = Object.fromEntries(REPORT_RESULTS.map((r) => [r, [] as OpnameItemDto[]])) as Record<
      ReportResult,
      OpnameItemDto[]
    >;
    for (const row of rows) groups[row.result as ReportResult].push(toItemDto(row));
    const lines = await this.groupLineDtos(id);
    const same = (l: OpnameGroupLineDto) =>
      l.counted !== null &&
      l.counted.good === l.expected.good &&
      l.counted.needsRepair === l.expected.needsRepair &&
      l.counted.damaged === l.expected.damaged;
    return {
      session,
      groups,
      groupLines: {
        matched: lines.filter((l) => l.counted && same(l)),
        different: lines.filter((l) => l.counted && !same(l)),
        notCounted: lines.filter((l) => !l.counted),
      },
    };
  }

  // ---------------------------------------------------------------- session lifecycle

  async create(dto: CreateStockOpnameDto, actor: AuthUser): Promise<StockOpnameDto> {
    const officerIds = [...new Set(dto.officerIds ?? [])];
    if (officerIds.length > 0) {
      const found = await this.prisma.user.count({ where: { id: { in: officerIds }, isActive: true } });
      if (found !== officerIds.length) throw validation('officerIds', 'Petugas tidak ditemukan atau nonaktif');
    }
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const session = await tx.stockOpname.create({
          data: {
            name: dto.name,
            notes: dto.notes ?? null,
            plannedDate: new Date(`${dto.plannedDate}T00:00:00Z`),
            createdById: actor.id,
            officers: { create: officerIds.map((userId) => ({ userId })) },
          },
          select: { id: true },
        });
        // Snapshot: every live asset that is not disposed must be found.
        const assets = await tx.asset.findMany({
          where: { archivedAt: null, status: { not: 'DISPOSED' } },
          select: { id: true, condition: true, status: true },
        });
        await tx.stockOpnameItem.createMany({
          data: assets.map((a) => ({
            opnameId: session.id,
            assetId: a.id,
            expectedCondition: a.condition,
            expectedStatus: a.status,
          })),
        });
        // Counted goods are counted, not scanned: one line per active group item.
        const groupItems = await tx.groupItem.findMany({
          where: { archivedAt: null },
          select: { id: true, qtyGood: true, qtyNeedsRepair: true, qtyDamaged: true },
        });
        await tx.stockOpnameGroupLine.createMany({
          data: groupItems.map((g) => ({
            opnameId: session.id,
            groupItemId: g.id,
            expectedGood: g.qtyGood,
            expectedNeedsRepair: g.qtyNeedsRepair,
            expectedDamaged: g.qtyDamaged,
          })),
        });
        return session.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, ONE_OPEN_INDEX)) throw new ConflictException(OPNAME_OPEN_EXISTS);
      throw error;
    }
    const dto2 = await this.toDto(await this.getRow(id));
    await this.audit.record({
      action: 'opname.created',
      module: MODULE,
      entityId: id,
      after: { name: dto.name, plannedDate: dto.plannedDate, total: dto2.total, officerIds },
    });
    return dto2;
  }

  async close(id: string, actor: AuthUser): Promise<StockOpnameDto> {
    const session = await this.getRow(id);
    if (session.status !== 'OPEN') throw new ConflictException(OPNAME_NOT_OPEN);
    type Counts = { qtyGood: number; qtyNeedsRepair: number; qtyDamaged: number };
    const applied: { id: string; before: Counts; after: Counts }[] = [];
    await this.prisma.$transaction(async (tx) => {
      // Claiming the session first waits for scans and confirmations in flight (they hold it FOR SHARE)
      // and makes every later one see a closed session.
      const closed = await tx.stockOpname.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'CLOSED', closedById: actor.id, closedAt: new Date() },
      });
      if (closed.count !== 1) throw new ConflictException(OPNAME_NOT_OPEN);
      const pending = await tx.stockOpnameItem.findMany({
        where: { opnameId: id, result: 'PENDING' },
        select: {
          id: true,
          asset: {
            select: {
              archivedAt: true,
              status: true,
              loans: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
              maintenance: { where: { status: 'IN_PROGRESS' }, select: { id: true }, take: 1 },
            },
          },
        },
      });
      // Judge every unscanned row by the asset's state now, not at snapshot time.
      const byResult = new Map<OpnameResult, string[]>();
      for (const row of pending) {
        const a = row.asset;
        let result: OpnameResult = 'NOT_FOUND';
        if (!a || a.archivedAt || a.status === 'DISPOSED') result = 'REMOVED';
        else if (a.loans.length > 0) result = 'ON_LOAN';
        else if (a.maintenance.length > 0) result = 'IN_MAINTENANCE';
        byResult.set(result, [...(byResult.get(result) ?? []), row.id]);
      }
      for (const [result, ids] of byResult) {
        await tx.stockOpnameItem.updateMany({ where: { id: { in: ids }, result: 'PENDING', scannedAt: null }, data: { result } });
      }
      // Counted group lines become the new quantities; uncounted lines leave the item as it was.
      const counted = await tx.stockOpnameGroupLine.findMany({
        where: { opnameId: id, countedAt: { not: null } },
        include: { groupItem: true },
      });
      for (const line of counted) {
        const g = line.groupItem;
        const next = { qtyGood: line.countedGood!, qtyNeedsRepair: line.countedNeedsRepair!, qtyDamaged: line.countedDamaged! };
        if (g.archivedAt || (g.qtyGood === next.qtyGood && g.qtyNeedsRepair === next.qtyNeedsRepair && g.qtyDamaged === next.qtyDamaged)) {
          continue;
        }
        await tx.groupItem.update({ where: { id: g.id }, data: next });
        applied.push({
          id: g.id,
          before: { qtyGood: g.qtyGood, qtyNeedsRepair: g.qtyNeedsRepair, qtyDamaged: g.qtyDamaged },
          after: next,
        });
      }
    });
    for (const a of applied) {
      await this.audit.record({
        action: 'group_item.opname_applied',
        module: 'group_items',
        entityId: a.id,
        before: a.before,
        after: { ...a.after, opnameId: id },
      });
    }
    const result = await this.toDto(await this.getRow(id));
    await this.audit.record({ action: 'opname.closed', module: MODULE, entityId: id, after: { counts: result.counts } });
    return result;
  }

  async cancel(id: string): Promise<StockOpnameDto> {
    const updated = await this.prisma.stockOpname.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (updated.count !== 1) {
      await this.getRow(id);
      throw new ConflictException(OPNAME_NOT_OPEN);
    }
    await this.audit.record({ action: 'opname.cancelled', module: MODULE, entityId: id });
    return this.toDto(await this.getRow(id));
  }

  // ---------------------------------------------------------------- group lines

  async groupLines(id: string, actor: AuthUser): Promise<OpnameGroupLineDto[]> {
    this.assertCanView(actor);
    await this.getRow(id);
    return this.groupLineDtos(id);
  }

  async countGroupLine(id: string, lineId: string, dto: CountGroupLineDto, actor: AuthUser): Promise<OpnameGroupLineDto> {
    const session = await this.getRow(id);
    this.assertCanScan(session, actor);
    await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id);
      const updated = await tx.stockOpnameGroupLine.updateMany({
        where: { id: lineId, opnameId: id },
        data: {
          countedGood: dto.good,
          countedNeedsRepair: dto.needsRepair,
          countedDamaged: dto.damaged,
          countedAt: new Date(),
          countedById: actor.id,
        },
      });
      if (updated.count !== 1) throw new NotFoundException(OPNAME_ITEM_NOT_FOUND);
    });
    const line = (await this.groupLineDtos(id)).find((l) => l.id === lineId);
    if (!line) throw new NotFoundException(OPNAME_ITEM_NOT_FOUND);
    return line;
  }

  private async groupLineDtos(opnameId: string): Promise<OpnameGroupLineDto[]> {
    const [rows, org] = await Promise.all([
      this.prisma.stockOpnameGroupLine.findMany({
        where: { opnameId },
        include: {
          groupItem: {
            include: {
              category: { select: { golongan: true, number: true } },
              location: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: [{ groupItem: { location: { code: 'asc' } } }, { groupItem: { name: 'asc' } }],
      }),
      this.codes.org(this.prisma),
    ]);
    const counterIds = [...new Set(rows.map((r) => r.countedById).filter((v): v is string => Boolean(v)))];
    const counters = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: counterIds } }, select: { id: true, fullName: true } })).map((u) => [u.id, u]),
    );
    return rows.map((r) => {
      const g = r.groupItem;
      return {
        id: r.id,
        groupItem: {
          id: g.id,
          name: g.name,
          code: codePrefix({ golongan: g.category.golongan, roomCode: g.location.code, typeNumber: g.category.number, org, year: g.acquisitionYear }),
          room: g.location,
        },
        expected: { good: r.expectedGood, needsRepair: r.expectedNeedsRepair, damaged: r.expectedDamaged },
        counted:
          r.countedAt === null
            ? null
            : { good: r.countedGood!, needsRepair: r.countedNeedsRepair!, damaged: r.countedDamaged! },
        countedAt: r.countedAt,
        countedBy: r.countedById ? (counters.get(r.countedById) ?? null) : null,
      };
    });
  }

  // ---------------------------------------------------------------- scanning

  async scan(id: string, value: string, actor: AuthUser): Promise<ScanResultDto> {
    const session = await this.getRow(id);
    this.assertCanScan(session, actor);
    const parsed = parseScanValue(value);
    if (!parsed) throw validation('value', 'Kode atau QR tidak dikenali');

    const asset =
      'token' in parsed
        ? (
            await this.prisma.assetLabel.findUnique({
              where: { publicToken: parsed.token },
              select: { asset: { select: { id: true, archivedAt: true, status: true } } },
            })
          )?.asset
        : await this.prisma.asset.findUnique({
            where: { assetCode: parsed.assetCode },
            select: { id: true, archivedAt: true, status: true },
          });
    const rawKey = 'token' in parsed ? parsed.token : parsed.assetCode;

    if (asset) {
      const row = await this.prisma.stockOpnameItem.findUnique({
        where: { opnameId_assetId: { opnameId: id, assetId: asset.id } },
        include: itemInclude,
      });
      if (row && row.result !== 'UNREGISTERED') return this.markFound(row, actor);
      if (row) return { item: toItemDto(row), alreadyScanned: true };
      const note = asset.archivedAt
        ? 'Barang diarsipkan'
        : asset.status === 'DISPOSED'
          ? 'Barang sudah dilepas'
          : 'Terdaftar setelah sesi dibuka';
      return this.recordUnregistered(id, rawKey, actor, asset.id, note);
    }

    const existing = await this.prisma.stockOpnameItem.findFirst({
      where: { opnameId: id, assetId: null, rawValue: rawKey },
      include: itemInclude,
    });
    if (existing) return { item: toItemDto(existing), alreadyScanned: true };
    return this.recordUnregistered(id, rawKey, actor, null, 'QR atau kode tidak terdaftar');
  }

  async confirm(id: string, itemId: string, dto: ConfirmItemDto, actor: AuthUser): Promise<OpnameItemDto> {
    const session = await this.getRow(id);
    this.assertCanScan(session, actor);
    const row = await this.getItem(id, itemId);
    if (!row.scannedAt || (row.result !== 'MATCHED' && row.result !== 'CONDITION_DIFFERS')) {
      throw new ConflictException('Barang ini belum dipindai.');
    }
    const result: OpnameResult = dto.observedCondition === row.expectedCondition ? 'MATCHED' : 'CONDITION_DIFFERS';
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, id);
      return tx.stockOpnameItem.update({
        where: { id: itemId },
        data: { observedCondition: dto.observedCondition, note: dto.note ?? null, result },
        include: itemInclude,
      });
    });
    await this.audit.record({
      action: 'opname.confirmed',
      module: MODULE,
      entityId: row.assetId,
      after: { opnameId: id, itemId, observedCondition: dto.observedCondition, result },
    });
    return toItemDto(updated);
  }

  async applyCondition(id: string, itemId: string, actor: AuthUser): Promise<OpnameItemDto> {
    const session = await this.getRow(id);
    if (session.status !== 'CLOSED') throw new ConflictException('Sesi harus ditutup sebelum kondisi diterapkan.');
    const row = await this.getItem(id, itemId);
    if (row.result !== 'CONDITION_DIFFERS' || !row.assetId || !row.observedCondition) {
      throw new ConflictException('Baris ini tidak memiliki kondisi berbeda.');
    }
    if (row.conditionAppliedAt) throw new ConflictException('Kondisi sudah diterapkan.');
    const assetId = row.assetId;
    const condition = row.observedCondition;
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { archivedAt: true, status: true } });
    if (!asset || asset.archivedAt || asset.status === 'DISPOSED') {
      throw new ConflictException('Barang sudah diarsipkan atau dilepas.');
    }
    const log = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.stockOpnameItem.updateMany({
        where: { id: itemId, conditionAppliedAt: null },
        data: { conditionAppliedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictException('Kondisi sudah diterapkan.');
      const recorded = await this.conditions.record(
        tx,
        assetId,
        { condition, notes: `Stock opname: ${session.name}${row.note ? ` (${row.note})` : ''}`, source: 'OPNAME' },
        actor,
      );
      await tx.stockOpnameItem.update({ where: { id: itemId }, data: { conditionLogId: recorded.id } });
      return recorded;
    });
    await this.audit.record({
      action: 'opname.condition_applied',
      module: MODULE,
      entityId: assetId,
      before: { condition: log.previousCondition },
      after: { opnameId: id, itemId, condition, conditionLogId: log.id },
    });
    return toItemDto(await this.getItem(id, itemId));
  }

  // ---------------------------------------------------------------- internals

  private async markFound(row: ItemRow, actor: AuthUser): Promise<ScanResultDto> {
    if (row.scannedAt) return { item: toItemDto(row), alreadyScanned: true };
    const claimed = await this.prisma.$transaction(async (tx) => {
      await this.lockOpen(tx, row.opnameId);
      return tx.stockOpnameItem.updateMany({
        where: { id: row.id, scannedAt: null, result: 'PENDING' },
        data: {
          scannedAt: new Date(),
          scannedById: actor.id,
          observedCondition: row.expectedCondition,
          result: 'MATCHED',
        },
      });
    });
    const fresh = await this.prisma.stockOpnameItem.findUniqueOrThrow({ where: { id: row.id }, include: itemInclude });
    if (claimed.count !== 1) return { item: toItemDto(fresh), alreadyScanned: true };
    await this.audit.record({
      action: 'opname.scanned',
      module: MODULE,
      entityId: row.assetId,
      after: { opnameId: row.opnameId, itemId: row.id },
    });
    return { item: toItemDto(fresh), alreadyScanned: false };
  }

  private async recordUnregistered(
    opnameId: string,
    rawValue: string,
    actor: AuthUser,
    assetId: string | null,
    note: string,
  ): Promise<ScanResultDto> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await this.lockOpen(tx, opnameId);
        return tx.stockOpnameItem.create({
          data: { opnameId, assetId, rawValue, note, result: 'UNREGISTERED', scannedAt: new Date(), scannedById: actor.id },
          include: itemInclude,
        });
      });
      await this.audit.record({
        action: 'opname.unregistered',
        module: MODULE,
        entityId: assetId ?? opnameId,
        after: { opnameId, itemId: row.id, rawValue, note },
      });
      return { item: toItemDto(row), alreadyScanned: false };
    } catch (error) {
      // Same asset scanned twice at once: the unique (opname, asset) row already exists.
      if (assetId && isUniqueViolation(error)) {
        const row = await this.prisma.stockOpnameItem.findUniqueOrThrow({
          where: { opnameId_assetId: { opnameId, assetId } },
          include: itemInclude,
        });
        return { item: toItemDto(row), alreadyScanned: true };
      }
      throw error;
    }
  }

  /**
   * Holds the session row FOR SHARE for the rest of the transaction and refuses a session that is no
   * longer open. Close and cancel update that row, so they wait for writers already past this point.
   */
  private async lockOpen(tx: Prisma.TransactionClient, opnameId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT status::text AS status FROM stock_opnames WHERE id = ${opnameId}::uuid FOR SHARE`;
    if (rows[0]?.status !== 'OPEN') throw new ConflictException(OPNAME_NOT_OPEN);
  }

  private assertCanView(actor: AuthUser): void {
    const ok =
      actor.permissions.includes(PERMISSIONS.STOCK_OPNAMES_EXECUTE) ||
      actor.permissions.includes(PERMISSIONS.STOCK_OPNAMES_MANAGE);
    if (!ok) throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }

  private assertCanScan(session: OpnameRow, actor: AuthUser): void {
    if (session.status !== 'OPEN') throw new ConflictException(OPNAME_NOT_OPEN);
    if (actor.permissions.includes(PERMISSIONS.STOCK_OPNAMES_MANAGE)) return;
    if (session.officers.length > 0 && !session.officers.some((o) => o.userId === actor.id)) {
      throw new ForbiddenException(OPNAME_NOT_OFFICER);
    }
  }

  private async getRow(id: string): Promise<OpnameRow> {
    const row = await this.prisma.stockOpname.findUnique({ where: { id }, include: opnameInclude });
    if (!row) throw new NotFoundException(OPNAME_NOT_FOUND);
    return row;
  }

  private async getItem(opnameId: string, itemId: string): Promise<ItemRow> {
    const row = await this.prisma.stockOpnameItem.findFirst({ where: { id: itemId, opnameId }, include: itemInclude });
    if (!row) throw new NotFoundException(OPNAME_ITEM_NOT_FOUND);
    return row;
  }

  private async toDto(row: OpnameRow): Promise<StockOpnameDto> {
    const counts = await this.countsFor([row.id]);
    return toOpnameDto(row, counts.get(row.id) ?? emptyCounts());
  }

  private async countsFor(ids: string[]): Promise<Map<string, Record<OpnameResult, number>>> {
    const map = new Map<string, Record<OpnameResult, number>>();
    if (ids.length === 0) return map;
    const rows = await this.prisma.stockOpnameItem.groupBy({
      by: ['opnameId', 'result'],
      where: { opnameId: { in: ids } },
      _count: { _all: true },
    });
    for (const r of rows) {
      const counts = map.get(r.opnameId) ?? emptyCounts();
      counts[r.result] = r._count._all;
      map.set(r.opnameId, counts);
    }
    return map;
  }
}
