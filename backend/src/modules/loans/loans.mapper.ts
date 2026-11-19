import { daysOverdue, isoDateOnly } from '../../common/dates/jakarta.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { LoanDto } from './dto/loan.dto.js';

export const loanInclude = {
  asset: { select: { id: true, assetCode: true, name: true } },
  borrowerEmployee: { select: { id: true, fullName: true } },
  borrowerDepartment: { select: { id: true, name: true } },
  guarantorEmployee: { select: { id: true, fullName: true } },
  recordedBy: { select: { id: true, fullName: true } },
  returnedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.AssetLoanInclude;

export type LoanRow = Prisma.AssetLoanGetPayload<{ include: typeof loanInclude }>;

export function toLoanDto(row: LoanRow, now: Date = new Date()): LoanDto {
  const overdueDays = row.status === 'ACTIVE' ? daysOverdue(row.dueAt, now) : 0;
  return {
    id: row.id,
    status: row.status,
    asset: row.asset,
    borrowerType: row.borrowerType,
    borrowerEmployee: row.borrowerEmployee,
    borrowerName: row.borrowerName,
    borrowerDepartment: row.borrowerDepartment,
    borrowerContact: row.borrowerContact,
    guarantorEmployee: row.guarantorEmployee,
    purpose: row.purpose,
    loanedAt: isoDateOnly(row.loanedAt),
    dueAt: isoDateOnly(row.dueAt),
    returnedAt: row.returnedAt,
    returnCondition: row.returnCondition,
    returnNotes: row.returnNotes,
    previousStatus: row.previousStatus,
    isOverdue: overdueDays > 0,
    overdueDays,
    recordedBy: row.recordedBy,
    returnedBy: row.returnedBy,
    createdAt: row.createdAt,
  };
}

export function loanSnapshot(row: LoanRow) {
  return {
    loanId: row.id,
    status: row.status,
    borrowerType: row.borrowerType,
    borrowerEmployeeId: row.borrowerEmployeeId,
    borrowerName: row.borrowerName,
    guarantorEmployeeId: row.guarantorEmployeeId,
    loanedAt: isoDateOnly(row.loanedAt),
    dueAt: isoDateOnly(row.dueAt),
    returnedAt: row.returnedAt,
    returnCondition: row.returnCondition,
    previousStatus: row.previousStatus,
  };
}
