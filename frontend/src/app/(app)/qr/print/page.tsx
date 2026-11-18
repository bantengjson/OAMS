'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Printer, Search, Sheet } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner, PageSpinner } from '@/components/ui/spinner';
import { PrintSheet, useQrImages } from '@/features/qr/print-sheet';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { qrApi } from '@/lib/api/qr';
import { sheetLayout, STICKER_SIZES, type StickerSize } from '@/lib/print-layout';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { BulkQrResult } from '@/types/api';
import '@/app/print.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PrintPage() {
  const params = useSearchParams();
  const preselected = useMemo(
    () => (params.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)),
    [params],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [size, setSize] = useState<StickerSize>(40);
  const [prepared, setPrepared] = useState<BulkQrResult | null>(null);

  const assets = useQuery({
    queryKey: ['assets', 'picker', debounced],
    queryFn: () => assetsApi.list({ search: debounced || undefined, pageSize: 50 }),
    placeholderData: keepPreviousData,
  });
  const generate = useMutation({
    mutationFn: () => qrApi.bulkGenerate([...selected]),
    onSuccess: (res) => {
      setPrepared(res);
      if (res.items.length === 0) toast.error('Tidak ada QR yang bisa dicetak dari pilihan ini.');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const markPrinted = useMutation({
    mutationFn: (ids: string[]) => qrApi.markPrinted(ids),
    onSuccess: (res) => toast.success(`${res.updated} stiker dicatat sebagai sudah dicetak.`),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const items = useMemo(() => prepared?.items ?? [], [prepared]);
  const images = useQrImages(items);
  const layout = sheetLayout(size);
  const pageCount = Math.ceil(items.length / layout.perPage);

  // The browser fires `afterprint` whether the user printed or cancelled; counting both is the
  // safer error (an uncounted sticker on a desk is worse than an over-counted one).
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((i) => i.assetId);
    const handler = () => markPrinted.mutate(ids);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mutation object is stable enough; re-binding per render would double-fire
  }, [items]);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const rows = assets.data?.data ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <>
      <PageHeader
        title="Cetak QR"
        description="Pilih barang, tentukan ukuran stiker, lalu cetak lembar A4. Setiap stiker memuat QR dan kode inventaris."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Pilih barang</CardTitle>
            <CardDescription>Terpilih: {selected.size} barang. Barang yang diarsipkan tidak dicetak.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari kode atau nama barang" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={(e) => rows.forEach((r) => toggle(r.id, e.target.checked))}
                  aria-label="Pilih semua hasil"
                />
                Pilih semua hasil ({rows.length})
              </label>
              {selected.size > 0 ? (
                <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set())}>
                  Kosongkan pilihan
                </button>
              ) : null}
            </div>
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-md border border-border">
              {assets.isPending ? (
                <li className="flex justify-center py-6"><Spinner /></li>
              ) : rows.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada barang yang cocok.</li>
              ) : (
                rows.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />
                      <span className="font-mono text-xs text-muted-foreground">{r.assetCode}</span>
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="no-print">
            <CardHeader>
              <CardTitle>Lembar stiker</CardTitle>
              <CardDescription>A4, margin 10 mm, jarak antar stiker 4 mm.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset className="flex flex-wrap gap-4 text-sm">
                <legend className="mb-2 text-sm font-medium">Ukuran stiker</legend>
                {STICKER_SIZES.map((s) => {
                  const l = sheetLayout(s);
                  return (
                    <label key={s} className="inline-flex items-center gap-2">
                      <input type="radio" name="size" value={s} checked={size === s} onChange={() => setSize(s)} />
                      {s} × {s} mm <span className="text-muted-foreground">({l.columns} × {l.rows} = {l.perPage}/lembar)</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => generate.mutate()}
                  disabled={selected.size === 0}
                  loading={generate.isPending}
                  leftIcon={<Sheet className="h-4 w-4" />}
                >
                  Siapkan lembar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  disabled={items.length === 0 || !images.data}
                  leftIcon={<Printer className="h-4 w-4" />}
                >
                  Cetak
                </Button>
              </div>
              {prepared ? (
                <p className="text-sm text-muted-foreground">
                  {items.length} stiker pada {pageCount} lembar.
                  {prepared.skipped.length > 0 ? ` ${prepared.skipped.length} barang dilewati (diarsipkan).` : ''}
                </p>
              ) : null}
              {prepared && items.length > 0 && pageCount > 1 ? (
                <Alert variant="info">Pratinjau hanya menampilkan lembar pertama; semua {pageCount} lembar ikut tercetak.</Alert>
              ) : null}
            </CardContent>
          </Card>

          {items.length > 0 ? (
            <div className="no-print overflow-auto rounded-lg border border-border bg-muted/40 p-4">
              {images.isPending ? <PageSpinner label="Membuat QR..." /> : null}
              <PrintSheet items={items} size={size} images={images.data ?? {}} previewOnly />
            </div>
          ) : null}
        </div>
      </div>
      {/* Hidden full copy used only by the printer: every page, not just the preview. */}
      {items.length > 0 && images.data ? (
        <div className="hidden print:block">
          <PrintSheet items={items} size={size} images={images.data} />
        </div>
      ) : null}
    </>
  );
}

export default function PrintPageWithParams() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <PrintPage />
    </Suspense>
  );
}
