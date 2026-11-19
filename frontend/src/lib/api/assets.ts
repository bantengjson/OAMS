import type {
  AcquisitionMethod,
  AssetCondition,
  AssetDetail,
  AssetDocument,
  AssetHistoryEntry,
  AssetListItem,
  AssetPhoto,
  AssetStatistics,
  AssetStatus,
  Assignment,
  ConditionLog,
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
  responsibleEmployeeId?: string;
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
  responsibleEmployeeId?: string | null;
  notes?: string | null;
}

/** Editable fields: location, responsible and condition change only via mutation / condition check. */
export type AssetUpdateInput = Partial<Omit<AssetInput, 'locationId' | 'responsibleEmployeeId' | 'condition'>>;

export interface ConditionLogInput {
  condition: AssetCondition;
  notes?: string | null;
  checkedAt?: string | null;
}

export const assetsApi = {
  list: (query: AssetQuery = {}) => api.get<Paginated<AssetListItem>>('/assets', { query }),
  statistics: () => api.get<AssetStatistics>('/assets/statistics'),
  get: (id: string) => api.get<AssetDetail>(`/assets/${id}`),
  create: (input: AssetInput) => api.post<AssetDetail>('/assets', input),
  update: (id: string, input: AssetUpdateInput) => api.patch<AssetDetail>(`/assets/${id}`, input),
  archive: (id: string, reason?: string) =>
    api.post<AssetDetail>(`/assets/${id}/archive`, reason ? { reason } : {}),
  unarchive: (id: string) => api.post<AssetDetail>(`/assets/${id}/unarchive`),
  history: (id: string, query: PageQuery = {}) =>
    api.get<Paginated<AssetHistoryEntry>>(`/assets/${id}/history`, { query }),
  conditionLogs: (id: string, query: PageQuery = {}) =>
    api.get<Paginated<ConditionLog>>(`/assets/${id}/condition-logs`, { query }),
  createConditionLog: (id: string, input: ConditionLogInput) =>
    api.post<ConditionLog>(`/assets/${id}/condition-logs`, input),
  assignments: (id: string, query: PageQuery = {}) =>
    api.get<Paginated<Assignment>>(`/assets/${id}/assignments`, { query }),

  uploadPhoto: (id: string, file: File, caption?: string, conditionLogId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    if (conditionLogId) form.append('conditionLogId', conditionLogId);
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
