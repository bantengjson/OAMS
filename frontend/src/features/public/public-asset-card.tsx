import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CONDITION_LABEL, CONDITION_VARIANT, STATUS_LABEL, STATUS_VARIANT } from '@/lib/asset-labels';
import { qrApi } from '@/lib/api/qr';
import type { AssetCondition, AssetStatus } from '@/types/api';

/** The fields every visitor may see; staff get extra actions from the parent. */
export interface PublicCardData {
  assetCode: string;
  name: string;
  categoryName: string;
  brand: string | null;
  model: string | null;
  locationPath: string;
  status: AssetStatus;
  condition: AssetCondition;
  hasPhoto: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function PublicAssetCard({ token, data, footer }: { token: string; data: PublicCardData; footer?: ReactNode }) {
  const brandModel = [data.brand, data.model].filter(Boolean).join(' ');
  return (
    <Card className="overflow-hidden">
      {data.hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API, not a static asset
        <img
          src={qrApi.publicPhotoUrl(token, 'full')}
          alt={data.name}
          className="aspect-4/3 w-full bg-muted object-cover"
        />
      ) : null}
      <CardContent className="flex flex-col gap-4 pt-5">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{data.assetCode}</p>
          <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={STATUS_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            <Badge variant={CONDITION_VARIANT[data.condition]}>{CONDITION_LABEL[data.condition]}</Badge>
          </div>
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <Row label="Kategori">{data.categoryName}</Row>
          <Row label="Merek / tipe">{brandModel || '-'}</Row>
          <Row label="Lokasi">{data.locationPath}</Row>
        </dl>
        {footer}
      </CardContent>
    </Card>
  );
}
