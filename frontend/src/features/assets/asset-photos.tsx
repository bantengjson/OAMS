'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AuthImage } from '@/components/ui/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileDrop } from '@/components/ui/file-drop';
import { EmptyState } from '@/components/ui/page-header';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import type { AssetDetail, AssetPhoto } from '@/types/api';

export function AssetPhotos({ asset, canEdit }: { asset: AssetDetail; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<AssetPhoto | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await assetsApi.uploadPhoto(asset.id, file);
    },
    onSuccess: (_, files) => {
      toast.success(files.length > 1 ? `${files.length} foto diunggah.` : 'Foto diunggah.');
      void invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const setPrimary = useMutation({
    mutationFn: (photoId: string) => assetsApi.setPrimaryPhoto(asset.id, photoId),
    onSuccess: () => {
      toast.success('Foto utama diperbarui.');
      void invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (photoId: string) => assetsApi.deletePhoto(asset.id, photoId),
    onSuccess: () => {
      toast.success('Foto dihapus.');
      setDeleting(null);
      void invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !asset.isArchived ? (
        <FileDrop
          accept="image/jpeg,image/png,image/webp"
          maxBytes={10 * 1024 * 1024}
          multiple
          disabled={upload.isPending}
          hint="JPEG, PNG, atau WebP, maksimal 10 MB per foto. Foto pertama otomatis menjadi foto utama."
          onFiles={(files) => upload.mutate(files)}
        />
      ) : null}
      {upload.isPending ? <p className="text-sm text-muted-foreground">Mengunggah...</p> : null}

      {asset.photos.length === 0 ? (
        <EmptyState title="Belum ada foto" description="Unggah foto agar barang mudah dikenali saat stock opname." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {asset.photos.map((p) => (
            <figure key={p.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              <AuthImage path={p.urls.thumb} alt={p.caption ?? asset.name} className="aspect-square w-full object-cover" />
              {p.isPrimary ? (
                <Badge className="absolute left-2 top-2" variant="default">Utama</Badge>
              ) : null}
              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs text-muted-foreground">
                <span className="truncate">{p.caption || `${p.width ?? '?'}×${p.height ?? '?'}`}</span>
                {canEdit && !asset.isArchived ? (
                  <span className="flex shrink-0 gap-0.5">
                    {!p.isPrimary ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Jadikan foto utama" onClick={() => setPrimary.mutate(p.id)}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Hapus foto" onClick={() => setDeleting(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        loading={remove.isPending}
        destructive
        title="Hapus foto?"
        confirmLabel="Hapus"
      >
        Foto akan dihapus permanen dari penyimpanan. Tindakan ini dicatat di riwayat.
      </ConfirmDialog>
    </div>
  );
}
