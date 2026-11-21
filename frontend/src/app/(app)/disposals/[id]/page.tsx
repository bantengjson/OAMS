'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { downloadBlob } from '@/components/ui/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDrop } from '@/components/ui/file-drop';
import { PageSpinner } from '@/components/ui/spinner';
import { RevertDisposalDialog } from '@/features/disposals/revert-disposal-dialog';
import { assetsApi } from '@/lib/api/assets';
import { disposalsApi } from '@/lib/api/disposals';
import { getErrorMessage } from '@/lib/api/form-errors';
import { STATUS_LABEL, formatRupiah } from '@/lib/asset-labels';
import { useAuth } from '@/lib/auth/use-auth';
import { DISPOSAL_REASON_LABEL } from '@/lib/operation-labels';
import { formatDate, formatDateTime } from '@/lib/utils';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? '-'}</dd>
    </>
  );
}

export default function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [reverting, setReverting] = useState(false);
  const disposal = useQuery({ queryKey: ['disposals', 'detail', id], queryFn: () => disposalsApi.get(id) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const d = disposal.data!;
      for (const f of files) await assetsApi.uploadDocument(d.asset.id, f, 'Dokumen pelepasan', d.id);
    },
    onSuccess: () => {
      toast.success('Dokumen ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['disposals'] });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (disposal.isPending) return <PageSpinner />;
  if (disposal.isError) return <Alert variant="error">{getErrorMessage(disposal.error)}</Alert>;
  const d = disposal.data;
  const canManage = hasPermission('disposals.manage');

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/disposals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke pelepasan
        </Link>
        <div className="flex flex-col gap-3 rounded-card border border-l-4 border-border border-l-primary bg-card px-5 py-4 shadow-card sm:flex-row sm:items-start sm:justify-between lg:px-6 lg:py-5">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{d.asset.assetCode}</p>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground lg:text-[26px]">
              <Link href={`/assets/${d.asset.id}`} className="hover:underline">{d.asset.name}</Link>
            </h2>
            <div className="mt-2">
              {d.revertedAt ? <Badge variant="muted">Dibatalkan</Badge> : <Badge variant="destructive">Dilepas</Badge>}
            </div>
          </div>
          {canManage && !d.revertedAt ? (
            <Button variant="outline" onClick={() => setReverting(true)}>Batalkan pelepasan</Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pelepasan</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <Row label="Alasan">{DISPOSAL_REASON_LABEL[d.reason]}</Row>
              <Row label="Tanggal">{formatDate(d.disposedAt)}</Row>
              <Row label="Keterangan">{d.description}</Row>
              <Row label="Nilai jual">{d.value ? formatRupiah(d.value) : null}</Row>
              <Row label="Penerima">{d.recipient}</Row>
              <Row label="Status sebelum">{STATUS_LABEL[d.previousStatus]}</Row>
              <Row label="Dicatat">{`${formatDateTime(d.createdAt)} · ${d.disposedBy.fullName}`}</Row>
              {d.revertedAt ? (
                <Row label="Dibatalkan">{`${formatDateTime(d.revertedAt)} · ${d.revertedBy?.fullName ?? ''} · ${d.revertReason ?? ''}`}</Row>
              ) : null}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dokumen pendukung</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {d.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada dokumen, misalnya berita acara.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {d.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{doc.title ?? doc.originalName}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Download className="h-4 w-4" />}
                      onClick={async () => {
                        try {
                          downloadBlob(await assetsApi.documentBlob(doc.url), doc.originalName);
                        } catch (e) {
                          toast.error(getErrorMessage(e));
                        }
                      }}
                    >
                      Unduh
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {hasPermission('assets.update') ? (
              <FileDrop
                accept="application/pdf,image/jpeg,image/png,.docx,.xlsx"
                maxBytes={20 * 1024 * 1024}
                multiple
                disabled={upload.isPending}
                hint="PDF, DOCX, XLSX, JPEG, atau PNG, maksimal 20 MB."
                onFiles={(files) => upload.mutate(files)}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {reverting ? (
        <RevertDisposalDialog
          disposal={d}
          onClose={() => {
            setReverting(false);
            void disposal.refetch();
          }}
        />
      ) : null}
    </>
  );
}
