import type { Prisma } from '../../generated/prisma/client.js';
import type { PathIndex } from '../assets/assets.mapper.js';
import { buildPath } from '../locations/locations.rules.js';
import type { MutationDto } from './dto/mutation.dto.js';

export const mutationInclude = {
  asset: { select: { id: true, assetCode: true, name: true } },
  fromLocation: { select: { id: true, name: true } },
  toLocation: { select: { id: true, name: true } },
  fromResponsibleEmployee: { select: { id: true, fullName: true } },
  toResponsibleEmployee: { select: { id: true, fullName: true } },
  requestedBy: { select: { id: true, fullName: true } },
  decidedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AssetMutationInclude;

export type MutationRow = Prisma.AssetMutationGetPayload<{ include: typeof mutationInclude }>;

export function toMutationDto(row: MutationRow, paths: PathIndex): MutationDto {
  return {
    id: row.id,
    status: row.status,
    asset: row.asset,
    fromLocation: { ...row.fromLocation, path: buildPath(row.fromLocation.id, paths) },
    toLocation: row.toLocation ? { ...row.toLocation, path: buildPath(row.toLocation.id, paths) } : null,
    changesResponsible: row.changesResponsible,
    fromResponsibleEmployee: row.fromResponsibleEmployee,
    toResponsibleEmployee: row.toResponsibleEmployee,
    reason: row.reason,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    decisionNote: row.decisionNote,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
  };
}

/** Audit snapshot: ids only, plus the decision fields. */
export function mutationSnapshot(row: MutationRow) {
  return {
    mutationId: row.id,
    status: row.status,
    fromLocationId: row.fromLocationId,
    toLocationId: row.toLocationId,
    changesResponsible: row.changesResponsible,
    fromResponsibleEmployeeId: row.fromResponsibleEmployeeId,
    toResponsibleEmployeeId: row.toResponsibleEmployeeId,
    reason: row.reason,
    decisionNote: row.decisionNote,
  };
}
