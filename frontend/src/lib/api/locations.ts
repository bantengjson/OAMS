import type {
  Location,
  LocationTreeNode,
  LocationType,
  MasterDataQuery,
  Paginated,
} from '@/types/api';
import { api } from './client';

export interface LocationQuery extends MasterDataQuery {
  type?: LocationType;
  parentId?: string;
}

export interface CreateLocationInput {
  code: string;
  name: string;
  type: LocationType;
  parentId?: string | null;
  description?: string | null;
}

export interface UpdateLocationInput {
  code?: string;
  name?: string;
  description?: string | null;
  parentId?: string | null;
}

export const locationsApi = {
  list: (query: LocationQuery = {}) => api.get<Paginated<Location>>('/locations', { query }),
  tree: (includeInactive = false) =>
    api.get<LocationTreeNode[]>('/locations/tree', { query: { includeInactive } }),
  get: (id: string) => api.get<Location>(`/locations/${id}`),
  create: (input: CreateLocationInput) => api.post<Location>('/locations', input),
  update: (id: string, input: UpdateLocationInput) => api.patch<Location>(`/locations/${id}`, input),
  deactivate: (id: string) => api.post<Location>(`/locations/${id}/deactivate`),
  activate: (id: string) => api.post<Location>(`/locations/${id}/activate`),
};
