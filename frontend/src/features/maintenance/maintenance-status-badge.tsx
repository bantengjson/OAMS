import { Badge } from '@/components/ui/badge';
import { MAINTENANCE_STATUS_LABEL, MAINTENANCE_STATUS_VARIANT } from '@/lib/operation-labels';
import type { MaintenanceStatus } from '@/types/api';

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge variant={MAINTENANCE_STATUS_VARIANT[status]}>{MAINTENANCE_STATUS_LABEL[status]}</Badge>;
}
