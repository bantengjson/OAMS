'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { AuditLogTable } from '@/features/audit-logs/audit-log-table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { auditLogsApi } from '@/lib/api/audit-logs';
import type { AuditLogQuery } from '@/lib/api/audit-logs';
import { getErrorMessage } from '@/lib/api/form-errors';
import { useAuth } from '@/lib/auth/use-auth';

const MODULES = [
  'auth',
  'users',
  'roles',
  'categories',
  'departments',
  'locations',
  'settings',
] as const;

const RESTRICTED = new Set(['auth', 'users', 'roles', 'settings']);

/** Local date (Asia/Jakarta is the office zone; the browser zone is used for the picker). */
function startOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}
function endOfDayIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

export default function AuditLogsPage() {
  const { hasPermission } = useAuth();
  const canViewAll = hasPermission('audit_logs.view_all');
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const debouncedAction = useDebouncedValue(action);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const query: AuditLogQuery = {
    page,
    pageSize: 25,
    module: module || undefined,
    action: debouncedAction.trim() || undefined,
    from: startOfDayIso(from),
    to: endOfDayIso(to),
  };
  const logs = useQuery({ queryKey: ['audit-logs', query], queryFn: () => auditLogsApi.list(query) });

  const modules = MODULES.filter((m) => canViewAll || !RESTRICTED.has(m));

  return (
    <>
      <PageHeader
        title="Audit Log"
        description={
          canViewAll
            ? 'Seluruh aktivitas penting yang tercatat sistem. Bersifat hanya-baca.'
            : 'Aktivitas operasional (data master dan inventaris). Aktivitas akun dan role hanya dapat dilihat Super Admin.'
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field>
          <Label htmlFor="al-module">Modul</Label>
          <Select
            id="al-module"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua modul</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="al-action">Aksi</Label>
          <Input
            id="al-action"
            placeholder="mis. user.created"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field>
          <Label htmlFor="al-from">Dari</Label>
          <Input
            id="al-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field>
          <Label htmlFor="al-to">Sampai</Label>
          <Input
            id="al-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setModule('');
              setAction('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Reset filter
          </Button>
        </div>
      </div>

      {logs.isError ? <Alert variant="error">{getErrorMessage(logs.error)}</Alert> : null}

      <AuditLogTable rows={logs.data?.data ?? []} loading={logs.isPending} />

      {logs.data ? <Pagination meta={logs.data.meta} onPageChange={setPage} /> : null}
    </>
  );
}
