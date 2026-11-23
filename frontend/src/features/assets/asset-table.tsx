'use client';

import { Eye, ImageIcon, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SortableHeader } from '@/components/ui/sortable-header';
import { Table, TableMessage, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { ColumnDef } from '@/lib/column-prefs';
import { CONDITION_LABEL, STATUS_LABEL } from '@/lib/asset-labels';
import { useCategoryTone } from '@/hooks/use-category-tone';
import { CONDITION_TONE, STATUS_TONE, TONE_CLASS } from '@/lib/tones';
import { cn, formatDate, initials } from '@/lib/utils';
import type { AssetListItem } from '@/types/api';
import type { SortField } from './asset-list-state';

export function AssetStatusBadge({ status }: { status: AssetListItem['status'] }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/** Condition as a coloured dot and its label (lighter than a pill, per spec §7.2). */
export function AssetConditionBadge({ condition }: { condition: AssetListItem['condition'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-body">
      <span className={cn('h-[7px] w-[7px] rounded-full', TONE_CLASS[CONDITION_TONE[condition]].dot)} aria-hidden="true" />
      {CONDITION_LABEL[condition]}
    </span>
  );
}

export const ASSET_COLUMNS: ColumnDef[] = [
  { key: 'code', label: 'Kode', required: true },
  { key: 'name', label: 'Nama barang', required: true },
  { key: 'category', label: 'Jenis' },
  { key: 'room', label: 'Ruangan' },
  { key: 'status', label: 'Status' },
  { key: 'condition', label: 'Kondisi' },
  { key: 'responsible', label: 'Penanggung jawab' },
  { key: 'department', label: 'Unit kerja' },
  { key: 'updatedAt', label: 'Diperbarui' },
];
export const ASSET_DEFAULT_COLUMNS = ['code', 'name', 'category', 'room', 'status', 'condition', 'updatedAt'];

export interface AssetTableProps {
  rows: AssetListItem[];
  loading: boolean;
  /** Defaults to the default columns. */
  visible?: Set<string>;
  /** Sorting is offered only when onSort is given. */
  sort?: SortField;
  order?: 'asc' | 'desc';
  onSort?: (field: SortField, order: 'asc' | 'desc') => void;
  /** Row selection; omitted when the user may not act on a selection. */
  selection?: { ids: string[]; onChange: (ids: string[]) => void };
  canEdit?: boolean;
}

const DEFAULT_VISIBLE = new Set(ASSET_DEFAULT_COLUMNS);

export function AssetTable({
  rows,
  loading,
  visible = DEFAULT_VISIBLE,
  sort = 'createdAt',
  order = 'desc',
  onSort,
  selection,
  canEdit = false,
}: AssetTableProps) {
  const router = useRouter();
  const categoryTone = useCategoryTone();
  const show = (k: string) => visible.has(k);
  const cols = 2 + ASSET_COLUMNS.filter((c) => !c.required && show(c.key)).length + (selection ? 1 : 0) + 1;
  const pageIds = rows.map((r) => r.id);
  const picked = new Set(selection?.ids ?? []);
  const allPicked = pageIds.length > 0 && pageIds.every((id) => picked.has(id));
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <Table>
      <THead>
        <TR>
          {selection ? (
            <TH className="w-10">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                aria-label="Pilih semua di halaman ini"
                checked={allPicked}
                onChange={(e) => selection.onChange(e.target.checked ? pageIds : [])}
              />
            </TH>
          ) : null}
          {onSort ? (
            <>
              <SortableHeader label="Kode" field="assetCode" sort={sort} order={order} onSort={onSort} className="w-40" />
              <SortableHeader label="Nama barang" field="name" sort={sort} order={order} onSort={onSort} />
            </>
          ) : (
            <>
              <TH className="w-40">Kode</TH>
              <TH>Nama barang</TH>
            </>
          )}
          {show('category') ? <TH className="hidden md:table-cell">Jenis</TH> : null}
          {show('room') ? <TH className="hidden w-40 lg:table-cell">Ruangan</TH> : null}
          {show('status') ? <TH className="w-32">Status</TH> : null}
          {show('condition') ? <TH className="hidden w-32 lg:table-cell">Kondisi</TH> : null}
          {show('responsible') ? <TH className="hidden xl:table-cell">Penanggung jawab</TH> : null}
          {show('department') ? <TH className="hidden xl:table-cell">Unit kerja</TH> : null}
          {show('updatedAt') ? (
            onSort ? (
              <SortableHeader label="Diperbarui" field="updatedAt" sort={sort} order={order} onSort={onSort} className="hidden w-32 lg:table-cell" />
            ) : (
              <TH className="hidden w-32 lg:table-cell">Diperbarui</TH>
            )
          ) : null}
          <TH className="w-20"><span className="sr-only">Aksi</span></TH>
        </TR>
      </THead>
      <TBody>
        {loading ? (
          <TableMessage colSpan={cols}>Memuat...</TableMessage>
        ) : rows.length === 0 ? (
          <TableMessage colSpan={cols}>Tidak ada barang yang cocok.</TableMessage>
        ) : (
          rows.map((a) => {
            const isPicked = picked.has(a.id);
            return (
              <TR
                key={a.id}
                onClick={() => router.push(`/assets/${a.id}`)}
                className={cn('cursor-pointer', isPicked && 'bg-primary-soft/50 hover:bg-primary-soft/70')}
              >
                {selection ? (
                  <TD onClick={stop}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label={`Pilih ${a.name}`}
                      checked={isPicked}
                      onChange={(e) =>
                        selection.onChange(e.target.checked ? [...selection.ids, a.id] : selection.ids.filter((id) => id !== a.id))
                      }
                    />
                  </TD>
                ) : null}
                <TD className="whitespace-nowrap font-mono text-xs text-foreground">
                  <Link href={`/assets/${a.id}`} onClick={stop} className="hover:text-primary hover:underline">
                    {a.assetCode}
                  </Link>
                </TD>
                <TD>
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span className="truncate">{a.name}</span>
                    {a.hasPhoto ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Ada foto" /> : null}
                    {a.isArchived ? <Badge variant="muted">Arsip</Badge> : null}
                  </span>
                  {a.specification ? <p className="truncate text-xs text-muted-foreground">{a.specification}</p> : null}
                  {show('category') ? <p className="text-xs text-muted-foreground md:hidden">{a.category.name}</p> : null}
                </TD>
                {show('category') ? (
                  <TD className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-[2px]', TONE_CLASS[categoryTone(a.category.id)].dot)} aria-hidden="true" />
                      {a.category.name}
                    </span>
                  </TD>
                ) : null}
                {show('room') ? (
                  <TD className="hidden whitespace-nowrap lg:table-cell">{a.room ? `${a.room.code} · ${a.room.name}` : '—'}</TD>
                ) : null}
                {show('status') ? <TD><AssetStatusBadge status={a.status} /></TD> : null}
                {show('condition') ? <TD className="hidden lg:table-cell"><AssetConditionBadge condition={a.condition} /></TD> : null}
                {show('responsible') ? (
                  <TD className="hidden xl:table-cell">
                    {a.responsibleEmployee ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tone-violet-soft text-[10px] font-semibold text-tone-violet">
                          {initials(a.responsibleEmployee.fullName)}
                        </span>
                        <span className="truncate">{a.responsibleEmployee.fullName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                ) : null}
                {show('department') ? <TD className="hidden xl:table-cell">{a.department?.name ?? '—'}</TD> : null}
                {show('updatedAt') ? <TD className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{formatDate(a.updatedAt)}</TD> : null}
                <TD onClick={stop}>
                  <div className="flex justify-end gap-0.5">
                    <Link
                      href={`/assets/${a.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Lihat ${a.name}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    {canEdit && !a.isArchived && a.status !== 'DISPOSED' ? (
                      <Link
                        href={`/assets/${a.id}/edit`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Ubah ${a.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </TD>
              </TR>
            );
          })
        )}
      </TBody>
    </Table>
  );
}
