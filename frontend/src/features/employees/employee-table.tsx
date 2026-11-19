'use client';

import { MoreHorizontal, Pencil, Power } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/badge';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { Employee } from '@/types/api';

export function EmployeeTable({
  rows,
  loading,
  canManage,
  onEdit,
  onToggle,
}: {
  rows: Employee[];
  loading: boolean;
  canManage: boolean;
  onEdit: (e: Employee) => void;
  onToggle: (e: Employee) => void;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Nama</TH>
          <TH className="hidden w-36 md:table-cell">No. pegawai</TH>
          <TH className="hidden lg:table-cell">Unit kerja</TH>
          <TH className="hidden xl:table-cell">Jabatan</TH>
          <TH className="hidden xl:table-cell">Kontak</TH>
          <TH className="hidden w-28 md:table-cell">Akun</TH>
          <TH className="w-24">Status</TH>
          {canManage ? <TH className="w-12"><span className="sr-only">Aksi</span></TH> : null}
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={8}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={8}>Belum ada pegawai yang cocok.</TableMessage>
        ) : (
          rows.map((e) => (
            <TR key={e.id}>
              <TD>
                <Link href={`/employees/${e.id}`} className="font-medium hover:underline">
                  {e.fullName}
                </Link>
                {e.email ? <p className="text-xs text-muted-foreground">{e.email}</p> : null}
              </TD>
              <TD className="hidden font-mono text-xs md:table-cell">{e.employeeNumber ?? '-'}</TD>
              <TD className="hidden text-muted-foreground lg:table-cell">{e.department?.name ?? '-'}</TD>
              <TD className="hidden text-muted-foreground xl:table-cell">{e.position ?? '-'}</TD>
              <TD className="hidden text-muted-foreground xl:table-cell">{e.phone ?? '-'}</TD>
              <TD className="hidden text-xs text-muted-foreground md:table-cell">{e.user ? 'Ada' : '-'}</TD>
              <TD><StatusBadge active={e.isActive} /></TD>
              {canManage ? (
                <TD>
                  <DropdownMenu
                    align="end"
                    triggerLabel={`Aksi untuk ${e.fullName}`}
                    trigger={
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                    items={[
                      { label: 'Ubah', icon: Pencil, onSelect: () => onEdit(e) },
                      {
                        label: e.isActive ? 'Nonaktifkan' : 'Aktifkan',
                        icon: Power,
                        onSelect: () => onToggle(e),
                        destructive: e.isActive,
                      },
                    ]}
                  />
                </TD>
              ) : null}
            </TR>
          ))
        )}
      </TBody>
    </Table>
  );
}
