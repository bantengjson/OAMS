import type {
  AcquisitionMethod,
  AssetCondition,
  AssetDetail,
  AssetDocument,
  AssetListItem,
  AssetPhoto,
  AssetStatistics,
  AssetStatus,
  AuditLog,
  OwnershipType,
  PageQuery,
  Paginated,
} from '@/types/api';
import { api, apiUpload, fetchBlob } from './client';

export interface AssetQuery extends PageQuery {
  search?: string;
  categoryId?: string;
  locationId?: string;
  departmentId?: string;
  responsibleUserId?: string;
  condition?: AssetCondition;
  status?: AssetStatus;
  ownershipType?: OwnershipType;
  includeArchived?: boolean;
  sort?: 'name' | 'assetCode' | 'updatedAt' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface AssetInput {
  name: string;
  categoryId: string;
  locationId: string;
  ownershipType: OwnershipType;
  acquisitionMethod: AcquisitionMethod;
  condition: AssetCondition;
  status: AssetStatus;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  description?: string | null;
  acquisitionDate?: string | null;
  purchasePrice?: number | null;
  vendor?: string | null;
  departmentId?: string | null;
  responsibleUserId?: string | null;
  notes?: string | null;
}

export const assetsApi = {
  list: (query: AssetQuery = {}) => api.get<Paginated<AssetListItem>>('/assets', { query }),
  statistics: () => api.get<AssetStatistics>('/assets/statistics'),
  get: (id: string) => api.get<AssetDetail>(`/assets/${id}`),
  create: (input: AssetInput) => api.post<AssetDetail>('/assets', input),
  update: (id: string, input: Partial<AssetInput>) => api.patch<AssetDetail>(`/assets/${id}`, input),
  archive: (id: string, reason?: string) =>
    api.post<AssetDetail>(`/assets/${id}/archive`, reason ? { reason } : {}),
  unarchive: (id: string) => api.post<AssetDetail>(`/assets/${id}/unarchive`),
  history: (id: string, query: PageQuery = {}) =>
    api.get<Paginated<AuditLog>>(`/assets/${id}/history`, { query }),

  uploadPhoto: (id: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return apiUpload<AssetPhoto>(`/assets/${id}/photos`, form);
  },
  setPrimaryPhoto: (id: string, photoId: string) =>
    api.post<AssetPhoto>(`/assets/${id}/photos/${photoId}/primary`),
  deletePhoto: (id: string, photoId: string) => api.delete<void>(`/assets/${id}/photos/${photoId}`),
  /** Blob for an <img>/download; strips the API prefix the DTO url already carries. */
  photoBlob: (urlFromDto: string) => fetchBlob(urlFromDto.replace(/^\/api\/v1/, '')),

  uploadDocument: (id: string, file: File, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return apiUpload<AssetDocument>(`/assets/${id}/documents`, form);
  },
  deleteDocument: (id: string, documentId: string) =>
    api.delete<void>(`/assets/${id}/documents/${documentId}`),
  documentBlob: (urlFromDto: string) => fetchBlob(urlFromDto.replace(/^\/api\/v1/, '')),
};
