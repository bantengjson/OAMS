import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { isoDateOnly, jakartaToday } from '../../common/dates/jakarta.js';
import { paginate } from '../../common/dto/paginated.js';
import type { Paginated } from '../../common/dto/paginated.js';
import { pageArgs } from '../../common/dto/pagination.dto.js';
import { isUniqueViolation } from '../../common/prisma/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AssetStatus, Prisma } from '../../generated/prisma/client.js';
import { AssetConditionsService } from '../assets/asset-conditions.service.js';
import { ASSET_BORROWED, ASSET_NOT_FOUND } from '../assets/assets.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { MUTATION_PENDING_EXISTS } from '../mutations/mutations.service.js';
import type { CreateLoanDto, UpdateLoanDto } from './dto/create-loan.dto.js';
import type { LoanQueryDto } from './dto/loan-query.dto.js';
import type { LoanDto } from './dto/loan.dto.js';
import type { ReturnLoanDto } from './dto/return-loan.dto.js';
import { loanInclude, loanSnapshot, toLoanDto } from './loans.mapper.js';
import type { LoanRow } from './loans.mapper.js';

export const LOAN_NOT_FOUND = 'Peminjaman tidak ditemukan.';
export const LOAN_FINISHED = 'Peminjaman sudah selesai.';
export const ASSET_ARCHIVED_CONFLICT = 'Barang sudah diarsipkan.';
const MODULE = 'loans';
const ONE_ACTIVE_INDEX = 'asset_loans_one_active';
const VALIDATION_FAILED = 'Validasi gagal.';

type Tx = Prisma.TransactionClient;

function validationError(errors: Record<string, string[]>): BadRequestException {
  return new BadRequestException({ message: VALIDATION_FAILED, errors });
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly employees: EmployeesService,
    private readonly conditions: AssetConditionsService,
  ) {}

  async list(q: LoanQueryDto): Promise<Paginated<LoanDto>> {
    const today = new Date(`${jakartaToday()}T00:00:00Z`);
    const where: Prisma.AssetLoanWhereInput = {};
    if (q.state === 'active') where.status = 'ACTIVE';
    if (q.state === 'returned') where.status = 'RETURNED';
    if (q.state === 'overdue') {
      where.status = 'ACTIVE';
      where.dueAt = { lt: today };
    }
    if (q.assetId) where.assetId = q.assetId;
    if (q.borrowerEmployeeId) where.borrowerEmployeeId = q.borrowerEmployeeId;
    if (q.search) {
      const contains = { contains: q.search, mode: 'insensitive' as const };
      where.OR = [{ borrowerName: contains }, { asset: { assetCode: contains } }, { asset: { name: contains } }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.assetLoan.findMany({
        where,
        include: loanInclude,
        // ACTIVE sorts before RETURNED; among active loans the most overdue come first.
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.assetLoan.count({ where }),
    ]);
    const now = new Date();
    return paginate(
      rows.map((r) => toLoanDto(r, now)),
      total,
      q,
    );
  }

  async get(id: string): Promise<LoanDto> {
    return toLoanDto(await this.getRow(id));
  }

  async create(dto: CreateLoanDto, actor: AuthUser): Promise<LoanDto> {
    const errors: Record<string, string[]> = {};
    const today = jakartaToday();
    if (dto.borrowerType === 'EMPLOYEE' && !dto.borrowerEmployeeId) errors.borrowerEmployeeId = ['Pilih pegawai peminjam'];
    if (dto.borrowerType === 'EXTERNAL') {
      if (!dto.borrowerName) errors.borrowerName = ['Nama peminjam wajib diisi'];
      if (!dto.guarantorEmployeeId) errors.guarantorEmployeeId = ['Penjamin wajib diisi'];
    }
    if (dto.loanedAt > today) errors.loanedAt = ['Tanggal pinjam tidak boleh di masa depan'];
    if (dto.dueAt < dto.loanedAt) errors.dueAt = ['Rencana kembali tidak boleh sebelum tanggal pinjam'];
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      select: {
        id: true,
        status: true,
        archivedAt: true,
        _count: { select: { loans: { where: { status: 'ACTIVE' } }, mutations: { where: { status: 'PENDING' } } } },
      },
    });
    if (!asset) throw new NotFoundException(ASSET_NOT_FOUND);
    if (asset.archivedAt) throw new ConflictException(ASSET_ARCHIVED_CONFLICT);
    if (asset._count.loans > 0) throw new ConflictException(ASSET_BORROWED);
    if (asset._count.mutations > 0) throw new ConflictException(MUTATION_PENDING_EXISTS);

    let borrowerName = dto.borrowerName ?? '';
    let borrowerDepartmentId = dto.borrowerDepartmentId ?? null;
    const borrowerEmployeeId = dto.borrowerType === 'EMPLOYEE' ? dto.borrowerEmployeeId! : null;
    const guarantorEmployeeId = dto.borrowerType === 'EXTERNAL' ? dto.guarantorEmployeeId! : null;
    if (borrowerEmployeeId) {
      await this.employees.assertActive(this.prisma, borrowerEmployeeId);
      const emp = await this.prisma.employee.findUniqueOrThrow({
        where: { id: borrowerEmployeeId },
        select: { fullName: true, departmentId: true },
      });
      borrowerName = emp.fullName;
      borrowerDepartmentId = emp.departmentId;
    }
    if (guarantorEmployeeId) await this.employees.assertActive(this.prisma, guarantorEmployeeId);
    if (borrowerDepartmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: borrowerDepartmentId }, select: { id: true } });
      if (!dept) throw new BadRequestException('Referensi data tidak valid.');
    }

    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const current = await tx.asset.findUniqueOrThrow({ where: { id: asset.id }, select: { status: true } });
        const loan = await tx.assetLoan.create({
          data: {
            assetId: asset.id,
            borrowerType: dto.borrowerType,
            borrowerEmployeeId,
            borrowerName,
            borrowerDepartmentId,
            borrowerContact: dto.borrowerContact ?? null,
            guarantorEmployeeId,
            purpose: dto.purpose ?? null,
            loanedAt: new Date(`${dto.loanedAt}T00:00:00Z`),
            dueAt: new Date(`${dto.dueAt}T00:00:00Z`),
            previousStatus: current.status,
            recordedById: actor.id,
          },
          select: { id: true },
        });
        await tx.asset.update({ where: { id: asset.id }, data: { status: 'BORROWED' } });
        return loan.id;
      });
    } catch (error) {
      if (isUniqueViolation(error, ONE_ACTIVE_INDEX)) throw new ConflictException(ASSET_BORROWED);
      throw error;
    }

    const row = await this.getRow(id);
    await this.audit.record({ action: 'loan.created', module: MODULE, entityId: asset.id, after: loanSnapshot(row) });
    return toLoanDto(row);
  }

  async update(id: string, dto: UpdateLoanDto, actor: AuthUser): Promise<LoanDto> {
    void actor;
    const before = await this.getActive(id);
    if (dto.dueAt !== undefined && dto.dueAt < before.loanedAt.toISOString().slice(0, 10)) {
      throw validationError({ dueAt: ['Rencana kembali tidak boleh sebelum tanggal pinjam'] });
    }
    const data: Prisma.AssetLoanUncheckedUpdateInput = {};
    if (dto.dueAt !== undefined) data.dueAt = new Date(`${dto.dueAt}T00:00:00Z`);
    if (dto.purpose !== undefined) data.purpose = dto.purpose;
    if (dto.borrowerContact !== undefined) data.borrowerContact = dto.borrowerContact;
    const updated = await this.prisma.assetLoan.updateMany({ where: { id, status: 'ACTIVE' }, data });
    if (updated.count !== 1) throw new ConflictException(LOAN_FINISHED);
    const row = await this.getRow(id);
    await this.audit.record({
      action: 'loan.updated',
      module: MODULE,
      entityId: row.assetId,
      before: { loanId: id, dueAt: loanSnapshot(before).dueAt, purpose: before.purpose, borrowerContact: before.borrowerContact },
      after: { loanId: id, dueAt: loanSnapshot(row).dueAt, purpose: row.purpose, borrowerContact: row.borrowerContact },
    });
    return toLoanDto(row);
  }

  async return(id: string, dto: ReturnLoanDto, actor: AuthUser): Promise<LoanDto> {
    const loan = await this.getActive(id);
    const returnedAt = dto.returnedAt ? new Date(dto.returnedAt) : new Date();
    // Compare calendar days in Jakarta: `loanedAt` is a date column (UTC midnight = 07:00 WIB).
    if (jakartaToday(returnedAt) < isoDateOnly(loan.loanedAt)) {
      throw validationError({ returnedAt: ['Waktu pengembalian tidak boleh sebelum tanggal pinjam'] });
    }
    const restored: AssetStatus =
      loan.previousStatus === 'BORROWED' || loan.previousStatus === 'RETURNED' ? 'AVAILABLE' : loan.previousStatus;

    const result = await this.prisma.$transaction(async (tx: Tx) => {
      const closed = await tx.assetLoan.updateMany({
        where: { id, status: 'ACTIVE' },
        data: {
          status: 'RETURNED',
          returnedAt,
          returnCondition: dto.condition ?? null,
          returnNotes: dto.notes ?? null,
          returnedById: actor.id,
        },
      });
      if (closed.count !== 1) throw new ConflictException(LOAN_FINISHED);
      await tx.asset.update({ where: { id: loan.assetId }, data: { status: restored } });
      if (dto.condition) {
        return this.conditions.record(
          tx,
          loan.assetId,
          { condition: dto.condition, notes: dto.notes ?? null, source: 'LOAN_RETURN', loanId: id },
          actor,
        );
      }
      return null;
    });

    const row = await this.getRow(id);
    await this.audit.record({
      action: 'loan.returned',
      module: MODULE,
      entityId: row.assetId,
      before: { loanId: id, status: 'ACTIVE', assetStatus: 'BORROWED' },
      after: { ...loanSnapshot(row), assetStatus: restored },
    });
    if (result) {
      await this.audit.record({
        action: 'asset.condition_recorded',
        module: 'condition_logs',
        entityId: row.assetId,
        before: { condition: result.previousCondition },
        after: { condition: dto.condition, conditionLogId: result.id, source: 'LOAN_RETURN', loanId: id },
      });
    }
    return toLoanDto(row);
  }

  private async getRow(id: string): Promise<LoanRow> {
    const row = await this.prisma.assetLoan.findUnique({ where: { id }, include: loanInclude });
    if (!row) throw new NotFoundException(LOAN_NOT_FOUND);
    return row;
  }

  private async getActive(id: string): Promise<LoanRow> {
    const row = await this.getRow(id);
    if (row.status !== 'ACTIVE') throw new ConflictException(LOAN_FINISHED);
    return row;
  }
}
