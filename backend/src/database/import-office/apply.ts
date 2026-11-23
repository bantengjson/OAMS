import { randomUUID } from 'node:crypto';
import { ASSET_CODE_ORG_KEY, DEFAULT_ASSET_CODE_ORG, OFFICE_CODE, OFFICE_NAME } from '../../common/office.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { codePrefix, formatAssetCode } from '../../modules/assets/asset-code.js';
import { generatePublicToken } from '../../modules/qr/qr-token.js';
import type { ImportPlan, PlannedUnit } from './types.js';

/** Set after a successful import; a second run refuses instead of wiping the office data. */
export const IMPORT_MARKER_KEY = 'office_import_done';
export const IMPORT_ALREADY_DONE = 'Data kantor sudah ada; impor dibatalkan.';

export interface ImportResult {
  units: number;
  groups: number;
  disposed: number;
  types: number;
  rooms: number;
}

/** Codes for every planned unit, numbered per prefix from 01 (the import starts from empty counters). */
export function assignCodes(units: PlannedUnit[], org: string): string[] {
  const next = new Map<string, number>();
  return units.map((u) => {
    const prefix = codePrefix({ golongan: u.golongan, roomCode: u.roomCode, typeNumber: u.typeNumber, org, year: u.year });
    const n = (next.get(prefix) ?? 0) + 1;
    next.set(prefix, n);
    return formatAssetCode(prefix, n);
  });
}

export async function readOrg(prisma: Pick<PrismaClient, 'systemSetting'>): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: ASSET_CODE_ORG_KEY } });
  return typeof row?.value === 'string' && row.value ? row.value : DEFAULT_ASSET_CODE_ORG;
}

/** Removes every asset-related row and the test master data (types, extra locations); users stay. */
async function wipe(tx: Prisma.TransactionClient): Promise<void> {
  await tx.stockOpnameGroupLine.deleteMany();
  await tx.stockOpnameItem.deleteMany();
  await tx.stockOpnameOfficer.deleteMany();
  await tx.stockOpname.deleteMany();
  await tx.groupItem.deleteMany();
  await tx.assetPhoto.deleteMany();
  await tx.assetDocument.deleteMany();
  await tx.assetDisposal.deleteMany();
  await tx.maintenanceRecord.deleteMany();
  await tx.assetConditionLog.deleteMany();
  await tx.assetLoan.deleteMany();
  await tx.assetMutation.deleteMany();
  await tx.assetAssignment.deleteMany();
  await tx.assetLabel.deleteMany();
  await tx.asset.deleteMany();
  await tx.assetCodeSequence.deleteMany();
  await tx.category.deleteMany();
  const office = await tx.location.findUnique({ where: { code: OFFICE_CODE } });
  await tx.location.deleteMany({
    where: office ? { NOT: [{ id: office.id }, { parentId: office.id, type: 'ROOM' }] } : {},
  });
}

/**
 * Replaces the test data with the office inventory in one transaction: types, rooms, units (with
 * codes, QR labels and a first condition record), released units, group items. Refuses to run twice.
 */
export async function applyImport(
  prisma: PrismaClient,
  plan: ImportPlan,
  opts: { actorId: string; today: string },
): Promise<ImportResult> {
  const result = await prisma.$transaction(
    async (tx) => {
      if (await tx.systemSetting.findUnique({ where: { key: IMPORT_MARKER_KEY } })) throw new Error(IMPORT_ALREADY_DONE);
      await wipe(tx);

      const office = await tx.location.upsert({
        where: { code: OFFICE_CODE },
        update: {},
        create: { code: OFFICE_CODE, name: OFFICE_NAME, type: 'OFFICE' },
      });
      for (const room of plan.rooms) {
        await tx.location.upsert({
          where: { code: room.code },
          update: { name: room.name, isActive: true },
          create: { code: room.code, name: room.name, type: 'ROOM', parentId: office.id },
        });
      }
      const rooms = new Map((await tx.location.findMany({ where: { parentId: office.id, type: 'ROOM' } })).map((r) => [r.code, r.id]));

      await tx.category.createMany({
        data: plan.types.map((t) => ({
          code: `${t.golongan}-${String(t.number).padStart(3, '0')}`,
          golongan: t.golongan,
          number: t.number,
          name: t.name,
          isGroup: t.isGroup,
        })),
      });
      const types = new Map((await tx.category.findMany()).map((c) => [`${c.golongan}-${c.number}`, c.id]));
      const typeId = (golongan: string, number: number, origin: string) => {
        const id = types.get(`${golongan}-${number}`);
        if (!id) throw new Error(`Jenis ${golongan} ${number} tidak ada di daftar jenis (${origin}).`);
        return id;
      };
      const roomId = (code: string | null, origin: string) => {
        if (code === null) return null;
        const id = rooms.get(code);
        if (!id) throw new Error(`Ruangan ${code} tidak ada (${origin}).`);
        return id;
      };

      const org = await readOrg(tx);
      const codes = assignCodes(plan.units, org);
      const checkedAt = new Date(`${opts.today}T00:00:00Z`);
      const assets: Prisma.AssetCreateManyInput[] = [];
      const labels: Prisma.AssetLabelCreateManyInput[] = [];
      const logs: Prisma.AssetConditionLogCreateManyInput[] = [];
      const disposals: Prisma.AssetDisposalCreateManyInput[] = [];
      plan.units.forEach((u, i) => {
        const id = randomUUID();
        assets.push({
          id,
          assetCode: codes[i],
          name: u.name,
          categoryId: typeId(u.golongan, u.typeNumber, u.origin),
          locationId: roomId(u.roomCode, u.origin),
          specification: u.specification,
          serialNumber: u.serialNumber,
          acquisitionYear: u.year,
          source: u.source,
          acquisitionMethod: u.source ? 'GRANT' : 'PURCHASE',
          ownershipType: 'OFFICE',
          condition: u.condition,
          status: u.disposed ? 'DISPOSED' : 'IN_USE',
          notes: u.notes,
          createdById: opts.actorId,
        });
        labels.push({
          assetId: id,
          publicToken: generatePublicToken(),
          isActive: !u.disposed,
          revokedAt: u.disposed ? new Date() : null,
        });
        logs.push({ assetId: id, condition: u.condition, checkedAt, source: 'CREATE', checkedById: opts.actorId, notes: 'Impor data kantor' });
        if (u.disposed) {
          disposals.push({
            assetId: id,
            reason: 'OTHER',
            disposedAt: checkedAt,
            description: 'Keterangan Excel: Tidak Ada',
            previousStatus: 'IN_USE',
            labelWasActive: true,
            disposedById: opts.actorId,
          });
        }
      });
      await tx.asset.createMany({ data: assets });
      await tx.assetLabel.createMany({ data: labels });
      await tx.assetConditionLog.createMany({ data: logs });
      await tx.assetDisposal.createMany({ data: disposals });

      // Counters continue where the import stopped.
      const last = new Map<string, number>();
      for (const code of codes) {
        const cut = code.lastIndexOf('-');
        last.set(code.slice(0, cut), Math.max(last.get(code.slice(0, cut)) ?? 0, Number(code.slice(cut + 1))));
      }
      await tx.assetCodeSequence.createMany({ data: [...last].map(([prefix, lastNumber]) => ({ prefix, lastNumber })) });

      await tx.groupItem.createMany({
        data: plan.groups.map((g) => ({
          categoryId: typeId('NG', g.typeNumber, g.origin),
          locationId: roomId(g.roomCode, g.origin)!,
          name: g.name,
          specification: g.specification,
          acquisitionYear: g.year,
          source: g.source,
          qtyGood: g.good,
          qtyNeedsRepair: g.needsRepair,
          qtyDamaged: g.damaged,
          notes: g.notes,
          createdById: opts.actorId,
        })),
      });

      await tx.systemSetting.create({ data: { key: IMPORT_MARKER_KEY, value: { at: new Date().toISOString(), units: assets.length } } });
      return {
        units: assets.length,
        groups: plan.groups.length,
        disposed: disposals.length,
        types: plan.types.length,
        rooms: plan.rooms.length,
      };
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
  await prisma.auditLog.create({
    data: { action: 'import.office', module: 'import', actorId: opts.actorId, after: { ...result } },
  });
  return result;
}
