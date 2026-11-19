import { Badge } from '@/components/ui/badge';
import { MUTATION_STATUS_LABEL, MUTATION_STATUS_VARIANT } from '@/lib/operation-labels';
import type { MutationStatus } from '@/types/api';

export function MutationStatusBadge({ status }: { status: MutationStatus }) {
  return <Badge variant={MUTATION_STATUS_VARIANT[status]}>{MUTATION_STATUS_LABEL[status]}</Badge>;
}
