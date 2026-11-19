import { Badge } from '@/components/ui/badge';
import type { Loan } from '@/types/api';

export function LoanStateBadge({ loan }: { loan: Pick<Loan, 'status' | 'isOverdue' | 'overdueDays'> }) {
  if (loan.status === 'RETURNED') return <Badge variant="muted">Selesai</Badge>;
  if (loan.isOverdue) return <Badge variant="destructive">Terlambat {loan.overdueDays} hari</Badge>;
  return <Badge variant="default">Aktif</Badge>;
}
