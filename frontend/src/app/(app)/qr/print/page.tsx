'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Printer, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Spinner, PageSpinner } from '@/components/ui/spinner';
import { PrintSheet, useQrImages } from '@/features/qr/print-sheet';
import type { SheetItem } from '@/features/qr/print-sheet';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { qrApi } from '@/lib/api/qr';
import { sheetLayoutFor, STICKER_OPTIONS, stickerDims, type StickerOption } from '@/lib/print-layout';
import { copiesByAsset, duplicateEntry, removeEntry, syncSheet } from '@/lib/sticker-sheet';
import type { SheetEntry } from '@/lib/sticker-sheet';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { BulkQrItem } from '@/types/api';
import '@/app/print.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PrintPage() {
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const preselected = useMemo(
    () => (params.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)),
    [params],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected));
  // The sheet follows the ticks; copies and removals are made on the sheet itself.
  const [entries, setEntries] = useState<SheetEntry[]>(() => syncSheet([], preselected));
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [optionKey, setOptionKey] = useState<StickerOption['key']>('F90');
  // Items waiting for the user to confirm they were really printed (see afterprint below).
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const option = STICKER_OPTIONS.find((o) => o.key === optionKey) ?? STICKER_OPTIONS[3];

  const assets = useQuery({
    queryKey: ['assets', 'picker', debounced],
    queryFn: () => assetsApi.list({ search: debounced || undefined, pageSize: 50 }),
    placeholderData: keepPreviousData,
  });

  const select = (next: Set<string>) => {
    setSelected(next);
    setEntries((prev) => syncSheet(prev, [...next]));
  };
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    select(next);
  };

  // Print data for every item on the sheet. A deactivated label is never switched back on just by
  // ticking the item: it is listed below with its own "Aktifkan & sertakan" button.
  const sheetIds = useMemo(() => [...new Set(entries.map((e) => e.assetId))].sort(), [entries]);
  const prepared = useQuery({
    queryKey: ['qr', 'bulk', sheetIds],
    queryFn: () => qrApi.bulkGenerate(sheetIds, { activateInactive: false }),
    enabled: sheetIds.length > 0,
    placeholderData: keepPreviousData,
  });
  const itemByAsset = useMemo(() => {
    const map = new Map<string, BulkQrItem>();
    for (const i of prepared.data?.items ?? []) map.set(i.assetId, i);
    return map;
  }, [prepared.data]);
  const onSheet = new Set(sheetIds);
  const skipped = (prepared.data?.skipped ?? []).filter((s) => onSheet.has(s.assetId));
  const inactive = skipped.filter((s) => s.inactiveLabel);
  const otherSkipped = skipped.filter((s) => !s.inactiveLabel);

  const activate = useMutation({
    mutationFn: (ids: string[]) => qrApi.bulkGenerate(ids, { activateInactive: true }),
    onSuccess: () => {
      toast.success('QR diaktifkan dan disertakan di lembar.');
      void queryClient.invalidateQueries({ queryKey: ['qr', 'bulk'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const markPrinted = useMutation({
    mutationFn: (ids: string[]) => qrApi.markPrinted(ids),
    onSuccess: (res) => {
      toast.success(`${res.updated} barang dicatat sebagai sudah dicetak.`);
      setConfirmIds(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const sheetItems: SheetItem[] = entries.flatMap((e) => {
    const item = itemByAsset.get(e.assetId);
    return item ? [{ ...item, key: e.key }] : [];
  });
  const uniqueItems = useMemo(() => [...itemByAsset.values()], [itemByAsset]);
  const images = useQrImages(uniqueItems);
  const dims = stickerDims(option.spec);
  const layout = sheetLayoutFor(dims.widthMm, dims.heightMm);
  const pageCount = Math.ceil(sheetItems.length / layout.perPage);
  const copies = copiesByAsset(entries);
  const printedIds = [...new Set(sheetItems.map((i) => i.assetId))];
  const printedKey = printedIds.join(',');

  // The browser fires `afterprint` whether the user printed or cancelled the dialog, and cannot
  // tell which. So ask: only a confirmed print is recorded, each item once however many copies.
  useEffect(() => {
    if (!printedKey) return;
    const ids = printedKey.split(',');
    const handler = () => setConfirmIds(ids);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, [printedKey]);

  const rows = assets.data?.data ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const controls = (item: SheetItem) => (
    <>
      <button
        type="button"
        onClick={() => setEntries((prev) => duplicateEntry(prev, item.key))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-body shadow-card hover:text-primary"
        aria-label={`Salin stiker ${item.assetCode}`}
        title="Salin stiker"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          const { entries: rest, lastOf } = removeEntry(entries, item.key);
          setEntries(rest);
          if (lastOf) {
            const next = new Set(selected);
            next.delete(lastOf);
            setSelected(next);
          }
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-body shadow-card hover:text-destructive"
        aria-label={`Hapus stiker ${item.assetCode}`}
        title="Hapus stiker"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Cetak QR"
        description="Centang barang, atur salinan di pratinjau, lalu cetak lembar A4. Setiap stiker memuat QR dan kode inventaris."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Pilih barang</CardTitle>
            <CardDescription>Terpilih: {selected.size} barang. Barang yang diarsipkan atau dilepas tidak dicetak.</CardDescription>
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
                  onChange={(e) => {
                    const next = new Set(selected);
                    for (const r of rows) {
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                    }
                    select(next);
                  }}
                  aria-label="Pilih semua hasil"
                />
                Pilih semua hasil ({rows.length})
              </label>
              {selected.size > 0 ? (
                <button type="button" className="text-primary hover:underline" onClick={() => select(new Set())}>
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
                      {(copies[r.id] ?? 0) > 1 ? (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                          ×{copies[r.id]}
                        </span>
                      ) : null}
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
              <fieldset className="grid gap-2 text-sm sm:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">Jenis dan ukuran stiker</legend>
                {STICKER_OPTIONS.map((o) => {
                  const d = stickerDims(o.spec);
                  const l = sheetLayoutFor(d.widthMm, d.heightMm);
                  return (
                    <label key={o.key} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 has-checked:border-primary">
                      <input type="radio" name="sticker" value={o.key} checked={optionKey === o.key} onChange={() => setOptionKey(o.key)} className="mt-1" />
                      <span>
                        <span className="font-medium">{o.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {o.hint} · {l.columns} × {l.rows} = {l.perPage}/lembar
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => window.print()}
                  disabled={sheetItems.length === 0 || !images.data}
                  leftIcon={<Printer className="h-4 w-4" />}
                >
                  Cetak
                </Button>
                <p className="text-sm text-muted-foreground">
                  {sheetItems.length === 0
                    ? 'Centang barang untuk mulai mengisi lembar.'
                    : `${sheetItems.length} stiker pada ${pageCount} lembar.`}
                  {prepared.isFetching ? ' Menyiapkan QR…' : ''}
                </p>
              </div>
              {sheetItems.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Gunakan tombol di pojok kanan atas setiap stiker pada pratinjau untuk menyalin atau menghapusnya.
                </p>
              ) : null}
              {inactive.length > 0 ? (
                <Alert variant="info">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span>
                      QR {inactive.length} barang sedang dinonaktifkan, jadi tidak ikut lembar. Aktifkan bila stiker memang
                      akan dipasang lagi.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={activate.isPending}
                      onClick={() => activate.mutate(inactive.map((s) => s.assetId))}
                    >
                      Aktifkan &amp; sertakan
                    </Button>
                  </span>
                </Alert>
              ) : null}
              {otherSkipped.length > 0 ? (
                <Alert variant="info">{otherSkipped.length} barang dilewati karena diarsipkan atau sudah dilepas.</Alert>
              ) : null}
              {prepared.isError ? <Alert variant="error">{getErrorMessage(prepared.error)}</Alert> : null}
            </CardContent>
          </Card>

          {sheetItems.length > 0 ? (
            <div className="no-print max-h-[80vh] overflow-auto rounded-lg border border-border bg-muted/40 p-4">
              {images.isPending ? <PageSpinner label="Membuat QR..." /> : null}
              <PrintSheet items={sheetItems} spec={option.spec} images={images.data ?? {}} controls={controls} />
            </div>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={confirmIds !== null}
        onClose={() => setConfirmIds(null)}
        onConfirm={() => {
          if (confirmIds) markPrinted.mutate(confirmIds);
        }}
        title="Stiker sudah tercetak?"
        confirmLabel="Ya, catat sudah dicetak"
        cancelLabel="Tidak jadi"
        loading={markPrinted.isPending}
      >
        Jendela cetak sudah ditutup. Bila stiker benar-benar tercetak, {confirmIds?.length ?? 0} barang dicatat sebagai sudah
        dicetak (menambah hitungan cetak di halaman QR barang). Bila pencetakan dibatalkan, pilih Tidak jadi.
      </ConfirmDialog>

      {/* Hidden full copy used only by the printer: every page, no buttons. */}
      {sheetItems.length > 0 && images.data ? (
        <div className="hidden print:block">
          <PrintSheet items={sheetItems} spec={option.spec} images={images.data} />
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
