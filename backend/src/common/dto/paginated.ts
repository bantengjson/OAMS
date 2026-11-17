import type { PaginationQueryDto } from './pagination.dto.js';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(
  data: T[],
  total: number,
  q: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
): Paginated<T> {
  return {
    data,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.pageSize),
    },
  };
}
