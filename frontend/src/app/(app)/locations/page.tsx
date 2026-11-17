'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/spinner';
import { childTypeOf, LocationFormDialog } from '@/features/locations/location-form-dialog';
import { LocationTree } from '@/features/locations/location-tree';
import { getErrorMessage } from '@/lib/api/form-errors';
import { locationsApi } from '@/lib/api/locations';
import { useAuth } from '@/lib/auth/use-auth';
import { formatDateTime } from '@/lib/utils';
import { LOCATION_TYPE_LABEL } from '@/types/api';
import type { LocationType } from '@/types/api';

type FormState =
  | { mode: 'closed' }
  | { mode: 'create'; type: LocationType; parentId: string | null }
  | { mode: 'edit' };

export default function LocationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('locations.manage');
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ mode: 'closed' });
  const [confirmToggle, setConfirmToggle] = useState(false);

  const tree = useQuery({
    queryKey: ['locations', 'tree', includeInactive],
    queryFn: () => locationsApi.tree(includeInactive),
  });
  const selected = useQuery({
    queryKey: ['locations', 'detail', selectedId],
    queryFn: () => locationsApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['locations'] });
    void queryClient.invalidateQueries({ queryKey: ['count'] });
  };

  const toggle = useMutation({
    mutationFn: () =>
      selected.data!.isActive
        ? locationsApi.deactivate(selected.data!.id)
        : locationsApi.activate(selected.data!.id),
    onSuccess: (row) => {
      toast.success(`Lokasi ${row.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      setConfirmToggle(false);
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const detail = selected.data;
  const childType = detail ? childTypeOf(detail.type) : null;

  return (
    <>
      <PageHeader
        title="Lokasi"
        description="Struktur Kantor → Gedung → Lantai → Ruangan tempat barang berada."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Tampilkan nonaktif
            </label>
            {canManage ? (
              <Button
                onClick={() => setFormState({ mode: 'create', type: 'OFFICE', parentId: null })}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Tambah kantor
              </Button>
            ) : null}
          </>
        }
      />

      {tree.isError ? <Alert variant="error">{getErrorMessage(tree.error)}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Pohon lokasi</CardTitle>
          </CardHeader>
          <CardContent>
            {tree.isPending ? (
              <PageSpinner />
            ) : (
              <LocationTree nodes={tree.data ?? []} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">Pilih lokasi pada pohon untuk melihat detail.</p>
            ) : selected.isPending ? (
              <PageSpinner />
            ) : selected.isError || !detail ? (
              <Alert variant="error">{getErrorMessage(selected.error)}</Alert>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-lg font-semibold">{detail.name}</p>
                  <p className="text-sm text-muted-foreground">{detail.path}</p>
                </div>
                <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Kode</dt>
                  <dd className="font-mono text-xs">{detail.code}</dd>
                  <dt className="text-muted-foreground">Tipe</dt>
                  <dd>
                    <Badge variant="outline">{LOCATION_TYPE_LABEL[detail.type]}</Badge>
                  </dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge active={detail.isActive} />
                  </dd>
                  <dt className="text-muted-foreground">Deskripsi</dt>
                  <dd>{detail.description || '-'}</dd>
                  <dt className="text-muted-foreground">Diperbarui</dt>
                  <dd>{formatDateTime(detail.updatedAt)}</dd>
                </dl>
                {canManage ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    {childType ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          setFormState({ mode: 'create', type: childType, parentId: detail.id })
                        }
                        leftIcon={<Plus className="h-4 w-4" />}
                        disabled={!detail.isActive}
                      >
                        Tambah {LOCATION_TYPE_LABEL[childType].toLowerCase()}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFormState({ mode: 'edit' })}
                      leftIcon={<Pencil className="h-4 w-4" />}
                    >
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant={detail.isActive ? 'destructive' : 'secondary'}
                      onClick={() => setConfirmToggle(true)}
                      leftIcon={<Power className="h-4 w-4" />}
                    >
                      {detail.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LocationFormDialog
        open={formState.mode !== 'closed'}
        onClose={() => setFormState({ mode: 'closed' })}
        location={formState.mode === 'edit' ? detail : null}
        initialType={formState.mode === 'create' ? formState.type : undefined}
        initialParentId={formState.mode === 'create' ? formState.parentId : undefined}
        onSaved={(saved) => {
          setFormState({ mode: 'closed' });
          setSelectedId(saved.id);
          invalidate();
        }}
      />

      <ConfirmDialog
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        onConfirm={() => toggle.mutate()}
        loading={toggle.isPending}
        destructive={detail?.isActive ?? false}
        title={detail?.isActive ? 'Nonaktifkan lokasi?' : 'Aktifkan lokasi?'}
        confirmLabel={detail?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      >
        {detail?.isActive
          ? `"${detail?.name}" tidak akan bisa dipilih lagi. Lokasi anak harus dinonaktifkan terlebih dahulu.`
          : `"${detail?.name}" akan bisa dipilih kembali. Lokasi induk harus aktif.`}
      </ConfirmDialog>
    </>
  );
}
