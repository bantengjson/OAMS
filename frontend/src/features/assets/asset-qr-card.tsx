'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Power, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { downloadBlob } from '@/components/ui/auth-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSpinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/lib/api/form-errors';
import { qrApi } from '@/lib/api/qr';
import { qrDataUrl } from '@/lib/qr-image';
import { framedStickerPng } from '@/lib/sticker-image';
import { FramedSticker } from '@/features/qr/framed-sticker';
import { formatDateTime } from '@/lib/utils';
import type { AssetDetail } from '@/types/api';
import { noStickerReason } from './printable';

export function AssetQrCard({ asset, canGenerate }: { asset: AssetDetail; canGenerate: boolean }) {
  const queryClient = useQueryClient();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const info = useQuery({ queryKey: ['qr', asset.id], queryFn: () => qrApi.info(asset.id) });
  const image = useQuery({
    queryKey: ['qr-image', info.data?.url],
    queryFn: () => qrDataUrl(info.data!.url, 512),
    enabled: Boolean(info.data?.url),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['qr', asset.id] });
    void queryClient.invalidateQueries({ queryKey: ['assets', 'detail', asset.id] });
  };
  const regenerate = useMutation({
    mutationFn: () => qrApi.regenerate(asset.id),
    onSuccess: () => {
      toast.success('Token QR baru dibuat. Stiker lama tidak berlaku lagi.');
      setConfirmRegenerate(false);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: () => (info.data?.isActive ? qrApi.deactivate(asset.id) : qrApi.activate(asset.id)),
    onSuccess: (res) => {
      toast.success(res.isActive ? 'QR Code diaktifkan.' : 'QR Code dinonaktifkan.');
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const downloadFramed = async () => {
    if (!info.data) return;
    try {
      downloadBlob(await framedStickerPng(info.data.url, asset.assetCode), `${asset.assetCode}-stiker.png`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const download = async (format: 'png' | 'svg') => {
    try {
      downloadBlob(await qrApi.download(asset.id, format, 1000), `${asset.assetCode}.${format}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (info.isPending) return <PageSpinner />;
  if (info.isError) return <Alert variant="error">{getErrorMessage(info.error)}</Alert>;
  const qr = info.data;
  const noSticker = noStickerReason(asset);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6">
          {image.data ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL preview
            <img src={image.data} alt={`QR Code ${asset.assetCode}`} className="w-56 rounded-md border border-border bg-white p-2" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-md border border-border text-sm text-muted-foreground">Membuat QR...</div>
          )}
          <p className="font-mono text-sm">{asset.assetCode}</p>
          <Badge variant={qr.isActive ? 'success' : 'muted'}>{qr.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR Code</CardTitle>
          <CardDescription>Stiker hanya memuat QR; isinya alamat halaman barang ini.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            <dt className="text-muted-foreground">Alamat</dt>
            <dd className="break-all">
              <a href={qr.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{qr.url}</a>
            </dd>
            <dt className="text-muted-foreground">Token</dt>
            <dd className="break-all font-mono text-xs">{qr.token}</dd>
            <dt className="text-muted-foreground">Dibuat</dt>
            <dd>{formatDateTime(qr.generatedAt)}</dd>
            <dt className="text-muted-foreground">Dicetak</dt>
            <dd>{qr.printedCount} kali{qr.lastPrintedAt ? `, terakhir ${formatDateTime(qr.lastPrintedAt)}` : ''}</dd>
          </dl>

          {noSticker ? <Alert variant="info">{noSticker}</Alert> : null}

          {!qr.isActive ? (
            <Alert variant="info">QR nonaktif: pemindaian menampilkan pesan &ldquo;tidak dikenal&rdquo;. Aktifkan kembali bila stiker masih dipakai.</Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Stiker berbingkai (90 × 60 mm)</p>
            <div className="w-fit overflow-hidden rounded-md border border-border bg-white shadow-sm">
              <FramedSticker widthMm={90} qrSrc={image.data ?? null} assetCode={asset.assetCode} />
            </div>
            <p className="text-xs text-muted-foreground">QR dan kode tertempel otomatis pada bingkai kantor; cetak massal lewat halaman Cetak QR.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void downloadFramed()} disabled={!info.data} leftIcon={<Download className="h-4 w-4" />}>Unduh stiker berbingkai</Button>
            <Button variant="outline" size="sm" onClick={() => void download('png')} leftIcon={<Download className="h-4 w-4" />}>Unduh QR PNG</Button>
            <Button variant="outline" size="sm" onClick={() => void download('svg')} leftIcon={<Download className="h-4 w-4" />}>Unduh QR SVG</Button>
            {canGenerate ? (
              <>
                {noSticker ? null : (
                  <Link href={`/qr/print?ids=${asset.id}`}>
                    <Button variant="outline" size="sm" leftIcon={<Printer className="h-4 w-4" />}>Cetak stiker</Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={() => toggle.mutate()} loading={toggle.isPending} leftIcon={<Power className="h-4 w-4" />}>
                  {qr.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmRegenerate(true)} disabled={asset.isArchived} leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Buat token baru
                </Button>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        onConfirm={() => regenerate.mutate()}
        loading={regenerate.isPending}
        destructive
        title="Buat token QR baru?"
        confirmLabel="Buat token baru"
      >
        Semua stiker yang sudah dicetak untuk barang ini tidak akan berfungsi lagi dan harus dicetak ulang.
      </ConfirmDialog>
    </div>
  );
}
