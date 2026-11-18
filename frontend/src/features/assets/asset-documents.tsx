'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { downloadBlob } from '@/components/ui/auth-image';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FileDrop } from '@/components/ui/file-drop';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/page-header';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { formatBytes } from '@/lib/asset-labels';
import { formatDateTime } from '@/lib/utils';
import type { AssetDetail, AssetDocument } from '@/types/api';

export function AssetDocuments({ asset, canEdit }: { asset: AssetDetail; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<AssetDocument | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] });

  const upload = useMutation({
    mutationFn: (file: File) => assetsApi.uploadDocument(asset.id, file, title.trim() || undefined),
    onSuccess: () => {
      toast.success('Dokumen diunggah.');
      setTitle('');
      void invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (documentId: string) => assetsApi.deleteDocument(asset.id, documentId),
    onSuccess: () => {
      toast.success('Dokumen dihapus.');
      setDeleting(null);
      void invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const download = async (doc: AssetDocument) => {
    try {
      downloadBlob(await assetsApi.documentBlob(doc.url), doc.originalName);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !asset.isArchived ? (
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <Field>
            <Label htmlFor="doc-title">Judul dokumen</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Faktur pembelian" />
          </Field>
          <FileDrop
            accept=".pdf,.docx,.xlsx,image/jpeg,image/png"
            maxBytes={20 * 1024 * 1024}
            disabled={upload.isPending}
            hint="PDF, DOCX, XLSX, JPEG, atau PNG, maksimal 20 MB."
            onFiles={(files) => files[0] && upload.mutate(files[0])}
          />
        </div>
      ) : null}

      {asset.documents.length === 0 ? (
        <EmptyState title="Belum ada dokumen" description="Simpan faktur, garansi, atau perjanjian pinjaman di sini." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {asset.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title || d.originalName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.originalName} · {formatBytes(d.sizeBytes)} · {formatDateTime(d.createdAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void download(d)} leftIcon={<Download className="h-4 w-4" />}>
                Unduh
              </Button>
              {canEdit && !asset.isArchived ? (
                <Button variant="ghost" size="icon" className="text-destructive" aria-label="Hapus dokumen" onClick={() => setDeleting(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
        loading={remove.isPending}
        destructive
        title="Hapus dokumen?"
        confirmLabel="Hapus"
      >
        {deleting?.title || deleting?.originalName} akan dihapus permanen. Tindakan ini dicatat di riwayat.
      </ConfirmDialog>
    </div>
  );
}
