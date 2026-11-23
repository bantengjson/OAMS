'use client';

import { useQuery } from '@tanstack/react-query';
import { Boxes, LogIn, QrCode, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/spinner';
import { PublicAssetCard, type PublicCardData } from '@/features/public/public-asset-card';
import { ApiError } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/api/form-errors';
import { qrApi } from '@/lib/api/qr';
import { useAuth } from '@/lib/auth/use-auth';
import type { PublicLookup } from '@/types/api';

function toCard(data: PublicLookup): { card: PublicCardData; staffAssetId: string | null } {
  if ('isPublicView' in data) {
    return {
      staffAssetId: data.id,
      card: {
        assetCode: data.assetCode,
        name: data.name,
        categoryName: data.category.name,
        specification: data.specification,
        roomLabel: data.room ? `${data.room.code} · ${data.room.name}` : null,
        status: data.status,
        condition: data.condition,
        hasPhoto: data.photos.length > 0,
      },
    };
  }
  return {
    staffAssetId: null,
    card: {
      assetCode: data.assetCode,
      name: data.name,
      categoryName: data.category.name,
      specification: data.specification,
      roomLabel: data.room ? `${data.room.code} · ${data.room.name}` : null,
      status: data.status,
      condition: data.condition,
      hasPhoto: data.hasPhoto,
    },
  };
}

export default function PublicAssetPage() {
  const { token } = useParams<{ token: string }>();
  const { status } = useAuth();
  // Wait for the silent session restore so staff get the detailed shape on the first request.
  const lookup = useQuery({
    queryKey: ['public-asset', token, status],
    queryFn: () => qrApi.publicAsset(token),
    enabled: status !== 'loading',
    retry: false,
  });
  const loggedIn = status === 'authenticated';

  let body;
  if (lookup.isPending || status === 'loading') {
    body = <PageSpinner label="Mencari barang..." />;
  } else if (lookup.isError) {
    const notFound = lookup.error instanceof ApiError && lookup.error.status === 404;
    body = (
      <div className="flex flex-col gap-4">
        <Alert variant={notFound ? 'info' : 'error'} title={notFound ? 'QR tidak dikenal' : 'Gagal memuat'}>
          {getErrorMessage(lookup.error)}
        </Alert>
        <p className="text-sm text-muted-foreground">
          Stiker mungkin sudah diganti, dinonaktifkan, atau barangnya telah diarsipkan. Hubungi petugas inventaris bila
          barang ini masih dipakai.
        </p>
      </div>
    );
  } else {
    const { card, staffAssetId } = toCard(lookup.data);
    body = (
      <PublicAssetCard
        token={token}
        data={card}
        footer={
          staffAssetId ? (
            <Link href={`/assets/${staffAssetId}`} className="block">
              <Button className="w-full" leftIcon={<Boxes className="h-4 w-4" />}>Buka detail lengkap</Button>
            </Link>
          ) : null
        }
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <QrCode className="h-4 w-4" />
          </span>
          OAMS
        </div>
        {loggedIn ? (
          <Link href="/scan" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ScanLine className="h-4 w-4" /> Pindai lagi
          </Link>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/a/${token}`)}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <LogIn className="h-4 w-4" /> Masuk sebagai petugas
          </Link>
        )}
      </header>
      {body}
      <p className="mt-auto text-center text-xs text-muted-foreground">Office Asset Management System</p>
    </div>
  );
}
