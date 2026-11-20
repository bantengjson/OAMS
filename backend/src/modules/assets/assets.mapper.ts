import { daysOverdue, isoDateOnly } from '../../common/dates/jakarta.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { buildPath } from '../locations/locations.rules.js';
import type { AssetDetailDto, AssetDocumentDto, AssetListItemDto, AssetPhotoDto } from './dto/asset.dto.js';

export const assetListInclude = {
  category: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true, type: true, parentId: true } },
  department: { select: { id: true, code: true, name: true } },
  responsibleEmployee: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } },
  _count: { select: { photos: true } },
} satisfies Prisma.AssetInclude;

export const assetDetailInclude = {
  ...assetListInclude,
  createdBy: { select: { id: true, fullName: true } },
  archivedBy: { select: { id: true, fullName: true } },
  label: true,
  photos: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  documents: { orderBy: { createdAt: 'asc' } },
  loans: { where: { status: 'ACTIVE' }, take: 1 },
  maintenance: { where: { status: { in: ['REPORTED', 'IN_PROGRESS'] } }, take: 1 },
  disposals: { where: { revertedAt: null }, take: 1 },
  mutations: {
    where: { status: 'PENDING' },
    take: 1,
    include: {
      requestedBy: { select: { id: true, fullName: true } },
      toLocation: { select: { id: true, name: true } },
      toResponsibleEmployee: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.AssetInclude;

export type AssetListRow = Prisma.AssetGetPayload<{ include: typeof assetListInclude }>;
export type AssetDetailRow = Prisma.AssetGetPayload<{ include: typeof assetDetailInclude }>;

export type PathIndex = Map<string, { name: string; parentId: string | null }>;

/** Plain-object fields shared by list and detail (kept untyped so spreading stays lint-clean). */
function listFields(row: AssetListRow, paths: PathIndex) {
  return {
    id: row.id,
    assetCode: row.assetCode,
    name: row.name,
    category: row.category,
    location: row.location
      ? {
          id: row.location.id,
          code: row.location.code,
          name: row.location.name,
          type: row.location.type,
          path: buildPath(row.location.id, paths),
        }
      : null,
    department: row.department,
    responsibleEmployee: row.responsibleEmployee,
    brand: row.brand,
    model: row.model,
    condition: row.condition,
    status: row.status,
    ownershipType: row.ownershipType,
    hasPhoto: row._count.photos > 0,
    isArchived: row.archivedAt !== null,
    updatedAt: row.updatedAt,
  };
}

export function toAssetListItem(row: AssetListRow, paths: PathIndex): AssetListItemDto {
  return listFields(row, paths);
}

export function photoUrls(assetId: string, photoId: string): { full: string; thumb: string } {
  const base = `/api/v1/assets/${assetId}/photos/${photoId}/file`;
  return { full: `${base}?variant=full`, thumb: `${base}?variant=thumb` };
}

export function toAssetPhoto(assetId: string, p: AssetDetailRow['photos'][number]): AssetPhotoDto {
  return {
    id: p.id,
    isPrimary: p.isPrimary,
    caption: p.caption,
    width: p.width,
    height: p.height,
    sizeBytes: p.sizeBytes,
    createdAt: p.createdAt,
    conditionLogId: p.conditionLogId,
    urls: photoUrls(assetId, p.id),
  };
}

export function toAssetDocument(assetId: string, d: AssetDetailRow['documents'][number]): AssetDocumentDto {
  return {
    id: d.id,
    title: d.title,
    originalName: d.originalName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt,
    url: `/api/v1/assets/${assetId}/documents/${d.id}/file`,
  };
}

export function qrUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/a/${token}`;
}

export function toAssetDetail(row: AssetDetailRow, paths: PathIndex, baseUrl: string): AssetDetailDto {
  const loan = row.loans[0];
  const maint = row.maintenance[0];
  const disposal = row.disposals[0];
  const mutation = row.mutations[0];
  return {
    activeDisposal: disposal
      ? { id: disposal.id, reason: disposal.reason, disposedAt: isoDateOnly(disposal.disposedAt) }
      : null,
    openMaintenance: maint
      ? {
          id: maint.id,
          status: maint.status as 'REPORTED' | 'IN_PROGRESS',
          description: maint.description,
          reportedAt: maint.reportedAt,
        }
      : null,
    activeLoan: loan
      ? {
          id: loan.id,
          borrowerName: loan.borrowerName,
          loanedAt: isoDateOnly(loan.loanedAt),
          dueAt: isoDateOnly(loan.dueAt),
          isOverdue: daysOverdue(loan.dueAt) > 0,
        }
      : null,
    pendingMutation: mutation
      ? {
          id: mutation.id,
          requestedAt: mutation.requestedAt,
          requestedBy: mutation.requestedBy,
          toLocation: mutation.toLocation
            ? { ...mutation.toLocation, path: buildPath(mutation.toLocation.id, paths) }
            : null,
          changesResponsible: mutation.changesResponsible,
          toResponsibleEmployee: mutation.toResponsibleEmployee,
        }
      : null,
    ...listFields(row, paths),
    serialNumber: row.serialNumber,
    description: row.description,
    acquisitionMethod: row.acquisitionMethod,
    acquisitionDate: row.acquisitionDate ? row.acquisitionDate.toISOString().slice(0, 10) : null,
    purchasePrice: row.purchasePrice ? row.purchasePrice.toFixed(2) : null,
    vendor: row.vendor,
    notes: row.notes,
    archivedAt: row.archivedAt,
    archiveReason: row.archiveReason,
    archivedBy: row.archivedBy,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    photos: row.photos.map((p) => toAssetPhoto(row.id, p)),
    documents: row.documents.map((d) => toAssetDocument(row.id, d)),
    label: row.label
      ? {
          token: row.label.publicToken,
          isActive: row.label.isActive,
          url: qrUrl(baseUrl, row.label.publicToken),
          printedCount: row.label.printedCount,
          lastPrintedAt: row.label.lastPrintedAt,
          generatedAt: row.label.generatedAt,
        }
      : null,
  };
}

/** Audit snapshot: scalar fields only, no relations or timestamps. */
export function assetSnapshot(row: AssetDetailRow | AssetListRow) {
  const r = row as AssetDetailRow;
  return {
    assetCode: r.assetCode,
    name: r.name,
    categoryId: r.categoryId,
    brand: r.brand,
    model: r.model,
    serialNumber: r.serialNumber,
    description: r.description,
    ownershipType: r.ownershipType,
    acquisitionMethod: r.acquisitionMethod,
    acquisitionDate: r.acquisitionDate ? r.acquisitionDate.toISOString().slice(0, 10) : null,
    purchasePrice: r.purchasePrice ? r.purchasePrice.toFixed(2) : null,
    vendor: r.vendor,
    locationId: r.locationId,
    departmentId: r.departmentId,
    condition: r.condition,
    status: r.status,
    responsibleEmployeeId: r.responsibleEmployeeId,
    notes: r.notes,
    archivedAt: r.archivedAt,
  };
}
