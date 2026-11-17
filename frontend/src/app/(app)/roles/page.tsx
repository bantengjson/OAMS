'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { RolePermissionsEditor } from '@/features/roles/role-permissions-editor';
import { getErrorMessage } from '@/lib/api/form-errors';
import { rolesApi } from '@/lib/api/roles';
import { useAuth } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = roles.data?.find((r) => r.id === selectedId) ?? roles.data?.[0] ?? null;

  return (
    <>
      <PageHeader
        title="Role & Izin"
        description="Empat role bawaan sistem dan permission yang dimilikinya."
      />

      {roles.isError ? <Alert variant="error">{getErrorMessage(roles.error)}</Alert> : null}

      {roles.isPending ? (
        <PageSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2">
            {roles.data?.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40',
                  active?.id === role.id ? 'border-primary ring-1 ring-primary' : 'border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{role.name}</p>
                  {role.isSystem ? <Badge variant="muted">Sistem</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {role.permissions.length} permission · {role.userCount} pengguna
                </p>
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="pt-5">
              {active ? (
                <RolePermissionsEditor
                  key={`${active.id}:${active.permissions.join(',')}`}
                  role={active}
                  canEdit={hasPermission('roles.manage')}
                  onSaved={() => void queryClient.invalidateQueries({ queryKey: ['roles'] })}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
