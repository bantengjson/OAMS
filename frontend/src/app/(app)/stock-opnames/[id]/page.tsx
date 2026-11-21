'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageSpinner } from '@/components/ui/spinner';
import { Tabs } from '@/components/ui/tabs';
import { OpnameCounters } from '@/features/stock-opnames/opname-counters';
import { OpnameItemList } from '@/features/stock-opnames/opname-item-list';
import { OpnameScanner } from '@/features/stock-opnames/opname-scanner';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { useAuth } from '@/lib/auth/use-auth';
import { OPNAME_STATUS_LABEL, OPNAME_STATUS_VARIANT } from '@/lib/operation-labels';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { OpnameItem } from '@/types/api';

type Tab = 'pending' | 'scanned' | 'unregistered';
type Pending = 'close' | 'cancel' | null;

const TAB_FILTER: Record<Tab, (i: OpnameItem) => boolean> = {
  pending: (i) => i.result === 'PENDING',
  scanned: (i) => i.result === 'MATCHED' || i.result === 'CONDITION_DIFFERS',
  unregistered: (i) => i.result === 'UNREGISTERED',
};
const TAB_EMPTY: Record<Tab, string> = {
  pending: 'Semua barang sudah dipindai.',
  scanned: 'Belum ada barang yang dipindai.',
  unregistered: 'Tidak ada pindaian di luar daftar.',
};

function matches(i: OpnameItem, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  return Boolean(
    i.asset?.name.toLowerCase().includes(t) || i.asset?.assetCode.toLowerCase().includes(t) || i.rawValue?.toLowerCase().includes(t),
  );
}

export default function StockOpnameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [term, setTerm] = useState('');
  const [pending, setPending] = useState<Pending>(null);

  const session = useQuery({ queryKey: ['stock-opnames', 'detail', id], queryFn: () => stockOpnamesApi.get(id) });
  const items = useQuery({ queryKey: ['stock-opnames', 'items', id], queryFn: () => stockOpnamesApi.items(id) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock-opnames'] });
    void queryClient.invalidateQueries({ queryKey: ['assets', 'statistics'] });
  };

  const finish = useMutation({
    mutationFn: (kind: 'close' | 'cancel') => (kind === 'close' ? stockOpnamesApi.close(id) : stockOpnamesApi.cancel(id)),
    onSuccess: (_, kind) => {
      toast.success(kind === 'close' ? 'Sesi ditutup.' : 'Sesi dibatalkan.');
      setPending(null);
      refresh();
    },
    onError: (e) => {
      toast.error(getErrorMessage(e));
      setPending(null);
    },
  });

  if (session.isPending) return <PageSpinner />;
  if (session.isError) return <Alert variant="error">{getErrorMessage(session.error)}</Alert>;
  const s = session.data;
  const open = s.status === 'OPEN';
  const canManage = hasPermission('stock_opnames.manage');
  const isOfficer = s.officers.length === 0 || s.officers.some((o) => o.id === user?.id);
  const canScan = open && hasPermission('stock_opnames.execute') && (canManage || isOfficer);
  const all = items.data?.data ?? [];
  const rows = all.filter((i) => TAB_FILTER[tab](i) && matches(i, term.trim()));
  const tabCount = (t: Tab) => all.filter(TAB_FILTER[t]).length;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/stock-opnames" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke stock opname
        </Link>
        <div className="flex flex-col gap-3 rounded-card border border-l-4 border-border border-l-primary bg-card px-5 py-4 shadow-card sm:flex-row sm:items-start sm:justify-between lg:px-6 lg:py-5">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground lg:text-[26px]">{s.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(s.plannedDate)} · Petugas: {s.officers.length > 0 ? s.officers.map((o) => o.fullName).join(', ') : 'semua'}
            </p>
            <div className="mt-2">
              <Badge variant={OPNAME_STATUS_VARIANT[s.status]}>{OPNAME_STATUS_LABEL[s.status]}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.status === 'CLOSED' ? (
              <Link href={`/stock-opnames/${s.id}/report`}>
                <Button leftIcon={<FileText className="h-4 w-4" />}>Lihat laporan</Button>
              </Link>
            ) : null}
            {open && canManage ? (
              <>
                <Button onClick={() => setPending('close')}>Tutup sesi</Button>
                <Button variant="outline" onClick={() => setPending('cancel')}>Batalkan</Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {s.notes ? <p className="text-sm text-muted-foreground">{s.notes}</p> : null}
      {s.status === 'CLOSED' ? (
        <Alert variant="success">
          Ditutup {formatDateTime(s.closedAt)}
          {s.closedBy ? ` oleh ${s.closedBy.fullName}` : ''}. Barang yang tidak dipindai sudah dinilai: dipinjam, diperbaiki, atau
          tidak ditemukan.
        </Alert>
      ) : null}
      {s.status === 'CANCELLED' ? <Alert variant="info">Sesi ini dibatalkan pada {formatDateTime(s.cancelledAt)}.</Alert> : null}
      {open && !canScan ? (
        <Alert variant="info">
          {hasPermission('stock_opnames.execute') ? 'Anda bukan petugas sesi ini.' : 'Anda hanya dapat melihat sesi ini.'}
        </Alert>
      ) : null}

      <div className={canScan ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]' : 'flex flex-col gap-6'}>
        {canScan ? (
          <Card>
            <CardHeader>
              <CardTitle>Pindai barang</CardTitle>
              <CardDescription>Arahkan kamera ke stiker QR, atau ketik kodenya.</CardDescription>
            </CardHeader>
            <CardContent>
              <OpnameScanner opnameId={s.id} onScanned={refresh} />
            </CardContent>
          </Card>
        ) : null}

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardContent className="pt-5">
              <OpnameCounters counts={s.counts} status={s.status} />
            </CardContent>
          </Card>
          {open ? (
            <>
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                items={[
                  { key: 'pending', label: 'Belum dipindai', badge: tabCount('pending') },
                  { key: 'scanned', label: 'Sudah dipindai', badge: tabCount('scanned') },
                  { key: 'unregistered', label: 'Tidak terdaftar', badge: tabCount('unregistered') },
                ]}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Cari nama atau kode..."
                  className="pl-9"
                  aria-label="Cari barang dalam sesi"
                />
              </div>
              {items.isError ? <Alert variant="error">{getErrorMessage(items.error)}</Alert> : null}
              <OpnameItemList rows={rows} loading={items.isPending} empty={TAB_EMPTY[tab]} />
            </>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={pending === 'close'}
        onClose={() => setPending(null)}
        onConfirm={() => finish.mutate('close')}
        title="Tutup sesi stock opname?"
        confirmLabel="Ya, tutup"
        loading={finish.isPending}
      >
        Barang yang belum dipindai akan dinilai otomatis: sedang dipinjam, sedang diperbaiki, atau tidak ditemukan. Setelah
        ditutup, pemindaian tidak bisa dilanjutkan.
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === 'cancel'}
        onClose={() => setPending(null)}
        onConfirm={() => finish.mutate('cancel')}
        title="Batalkan sesi stock opname?"
        confirmLabel="Ya, batalkan"
        destructive
        loading={finish.isPending}
      >
        Hasil pindaian sesi ini tidak akan dipakai. Tindakan ini tidak bisa diurungkan.
      </ConfirmDialog>
    </>
  );
}
