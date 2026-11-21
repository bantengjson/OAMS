import type { BulkQrResult, PublicLookup, QrInfo } from '@/types/api';
import { api, fetchBlob } from './client';

export const qrApi = {
  info: (assetId: string) => api.get<QrInfo>(`/assets/${assetId}/qr`),
  regenerate: (assetId: string) => api.post<QrInfo>(`/assets/${assetId}/qr/regenerate`),
  deactivate: (assetId: string) => api.post<QrInfo>(`/assets/${assetId}/qr/deactivate`),
  activate: (assetId: string) => api.post<QrInfo>(`/assets/${assetId}/qr/activate`),
  download: (assetId: string, format: 'png' | 'svg', size = 600) =>
    fetchBlob(`/assets/${assetId}/qr/download`, { format, size }),
  bulkGenerate: (assetIds: string[], opts: { activateInactive?: boolean } = {}) =>
    api.post<BulkQrResult>('/qr/bulk-generate', { assetIds, ...opts }),
  markPrinted: (assetIds: string[]) =>
    api.post<{ updated: number }>('/qr/mark-printed', { assetIds }),
  /** Anonymous or staff view of a scanned token (bearer attached automatically when logged in). */
  publicAsset: (token: string) => api.get<PublicLookup>(`/qr/public/${encodeURIComponent(token)}`),
  publicPhotoUrl: (token: string, variant: 'full' | 'thumb' = 'full') =>
    `/api/v1/qr/public/${encodeURIComponent(token)}/photo?variant=${variant}`,
};
