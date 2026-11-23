import type { SelectOption } from '@/components/ui/select-panel';

/**
 * Active/inactive filter shared by the account and master-data lists. The lists differ in which
 * of these they start on, so each passes its own `neutral` to the filter.
 */
export const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'all', label: 'Semua' },
];
