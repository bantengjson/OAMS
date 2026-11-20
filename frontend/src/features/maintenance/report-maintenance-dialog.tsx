'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FileDrop } from '@/components/ui/file-drop';
import { Textarea } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { AssetPicker } from '@/features/mutations/asset-picker';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { maintenanceApi } from '@/lib/api/maintenance';
import type { AssetListItem } from '@/types/api';

/** Report damage; with `asset` the asset is fixed (from its detail page), otherwise it is picked. */
export function ReportMaintenanceDialog({
  asset,
  onClose,
}: {
  asset?: { id: string; assetCode: string; name: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<AssetListItem | null>(null);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const assetId = asset?.id ?? picked?.id ?? '';

  const act = useMutation({
    mutationFn: async () => {
      const record = await maintenanceApi.report(assetId, description.trim());
      for (const file of files) await assetsApi.uploadPhoto(assetId, file, undefined, undefined, record.id);
      return record;
    },
    onSuccess: () => {
      toast.success('Kerusakan dilaporkan.');
      void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Lapor kerusakan"
      description={asset ? `${asset.assetCode} · ${asset.name}` : 'Admin akan memulai perbaikan dari laporan ini.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending} disabled={!assetId || !description.trim()}>
            Kirim laporan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {!asset ? (
          <Field>
            <Label required>Barang</Label>
            <AssetPicker value={picked} onChange={setPicked} />
          </Field>
        ) : null}
        <Field>
          <Label htmlFor="mr-description" required>Kerusakan</Label>
          <Textarea
            id="mr-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mis. kertas sering macet, layar bergaris"
          />
        </Field>
        <Field>
          <Label>Foto kerusakan</Label>
          <FileDrop
            accept="image/jpeg,image/png,image/webp"
            maxBytes={10 * 1024 * 1024}
            multiple
            disabled={act.isPending}
            hint="Opsional. JPEG, PNG, atau WebP, maksimal 10 MB per foto."
            onFiles={(more) => setFiles((prev) => [...prev, ...more])}
          />
          {files.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Hapus ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Field>
      </div>
    </Dialog>
  );
}
