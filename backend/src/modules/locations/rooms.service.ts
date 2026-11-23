import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { OFFICE_CODE } from '../../common/office.js';
import type { Location } from '../../generated/prisma/client.js';
import type { RoomDto, RoomQueryDto } from './dto/room.dto.js';
import { compareRoomCodes, nextRoomLetter } from './room-letter.js';

const MODULE = 'rooms';
export const ROOM_NOT_FOUND = 'Ruangan tidak ditemukan.';
export const ROOM_INVALID = 'Ruangan tidak valid atau tidak aktif.';

type Row = Location & { _count: { assets: number; groupItems: number } };
const withUse = { _count: { select: { assets: true, groupItems: true } } } as const;

function toDto(row: Row): RoomDto {
  return { id: row.id, code: row.code, name: row.name, isActive: row.isActive, inUse: row._count.assets + row._count.groupItems > 0 };
}

/** Rooms A–O (and any added later): locations of type ROOM under the office. */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: RoomQueryDto): Promise<RoomDto[]> {
    const rows = await this.prisma.location.findMany({
      where: { type: 'ROOM', parent: { code: OFFICE_CODE }, ...(q.isActive !== undefined ? { isActive: q.isActive } : {}) },
      include: withUse,
    });
    return rows.sort((a, b) => compareRoomCodes(a.code, b.code)).map(toDto);
  }

  async create(name: string): Promise<RoomDto> {
    const office = await this.prisma.location.findUnique({ where: { code: OFFICE_CODE } });
    if (!office) throw new NotFoundException('Kantor belum disiapkan.');
    const row = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent additions so two rooms never get the same letter.
      await tx.$queryRaw`SELECT id FROM locations WHERE id = ${office.id}::uuid FOR UPDATE`;
      const siblings = await tx.location.findMany({ where: { parentId: office.id }, select: { code: true } });
      const code = nextRoomLetter(siblings.map((s) => s.code));
      return tx.location.create({ data: { code, name, type: 'ROOM', parentId: office.id }, include: withUse });
    });
    await this.audit.record({ action: 'room.created', module: MODULE, entityId: row.id, after: { code: row.code, name: row.name } });
    return toDto(row);
  }

  async rename(id: string, name: string): Promise<RoomDto> {
    const before = await this.getRow(id);
    const row = await this.prisma.location.update({ where: { id }, data: { name }, include: withUse });
    await this.audit.record({
      action: 'room.updated',
      module: MODULE,
      entityId: id,
      before: { name: before.name },
      after: { name: row.name },
    });
    return toDto(row);
  }

  async setActive(id: string, isActive: boolean): Promise<RoomDto> {
    await this.getRow(id);
    const row = await this.prisma.location.update({ where: { id }, data: { isActive }, include: withUse });
    await this.audit.record({ action: isActive ? 'room.activated' : 'room.deactivated', module: MODULE, entityId: id, after: { isActive } });
    return toDto(row);
  }

  /** An active room, for asset and group-item forms; 400 otherwise. */
  async requireActive(id: string, tx: Pick<PrismaService, 'location'> = this.prisma): Promise<Location> {
    const row = await tx.location.findUnique({ where: { id } });
    if (!row || row.type !== 'ROOM' || !row.isActive) throw new BadRequestException(ROOM_INVALID);
    return row;
  }

  private async getRow(id: string): Promise<Row> {
    const row = await this.prisma.location.findUnique({ where: { id }, include: withUse });
    if (!row || row.type !== 'ROOM') throw new NotFoundException(ROOM_NOT_FOUND);
    return row;
  }
}
