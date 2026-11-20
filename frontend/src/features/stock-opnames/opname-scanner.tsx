'use client';

import { ScanLine } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { QrScannerView } from '@/features/scan/qr-scanner-view';
import { getErrorMessage } from '@/lib/api/form-errors';
import { stockOpnamesApi } from '@/lib/api/stock-opnames';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { OPNAME_RESULT_LABEL, OPNAME_RESULT_VARIANT } from '@/lib/operation-labels';
import { cn, formatDateTime } from '@/lib/utils';
import { ASSET_CONDITIONS } from '@/types/api';
import type { AssetCondition, OpnameItem, ScanResult } from '@/types/api';

/** A camera keeps decoding the sticker it is pointed at; the same value is ignored until it has been out of view this long. */
const REPEAT_WINDOW_MS = 3000;

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
}

export function OpnameScanner({ opnameId, onScanned }: { opnameId: string; onScanned: (item: OpnameItem) => void }) {
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [condition, setCondition] = useState<AssetCondition | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const recent = useRef<{ value: string; at: number } | null>(null);

  const scan = async (raw: string) => {
    const value = raw.trim();
    if (!value || busyRef.current) return;
    const now = Date.now();
    if (recent.current && recent.current.value === value && now - recent.current.at < REPEAT_WINDOW_MS) {
      recent.current.at = now;
      return;
    }
    recent.current = { value, at: now };
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await stockOpnamesApi.scan(opnameId, value);
      setLast(result);
      setCondition(result.item.observedCondition ?? result.item.expectedCondition ?? '');
      setNote(result.item.note ?? '');
      setManual('');
      vibrate(result.alreadyScanned || result.item.result === 'UNREGISTERED' ? 250 : 80);
      onScanned(result.item);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = async () => {
    if (!last || !condition) return;
    setSaving(true);
    try {
      const item = await stockOpnamesApi.confirm(opnameId, last.item.id, condition, note.trim() || null);
      setLast({ ...last, item });
      toast.success(item.result === 'CONDITION_DIFFERS' ? 'Disimpan: kondisi berbeda dari catatan.' : 'Kondisi disimpan.');
      onScanned(item);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const item = last?.item;
  const countable = item && (item.result === 'MATCHED' || item.result === 'CONDITION_DIFFERS');

  return (
    <div className="flex flex-col gap-4">
      <QrScannerView onDecode={(text) => void scan(text)} paused={busy} />

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          recent.current = null;
          void scan(manual);
        }}
      >
        <Field>
          <Label htmlFor="opname-manual">Kode barang atau alamat QR</Label>
          <div className="flex gap-2">
            <Input
              id="opname-manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Mis. INV-2026-0001"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <Button type="submit" loading={busy} disabled={!manual.trim()} leftIcon={<ScanLine className="h-4 w-4" />}>
              Pindai
            </Button>
          </div>
          <FieldHint>Ketik kode dari stiker bila kamera tidak bisa membaca QR.</FieldHint>
        </Field>
      </form>

      {item ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {item.asset ? (
                <>
                  <p className="font-mono text-xs text-muted-foreground">{item.asset.assetCode}</p>
                  <p className="font-medium">{item.asset.name}</p>
                  <p className="text-xs text-muted-foreground">{item.asset.category.name}</p>
                </>
              ) : (
                <p className="break-all font-mono text-sm">{item.rawValue}</p>
              )}
            </div>
            <Badge variant={OPNAME_RESULT_VARIANT[item.result]}>{OPNAME_RESULT_LABEL[item.result]}</Badge>
          </div>

          {last?.alreadyScanned ? (
            <Alert variant="info">
              Sudah dihitung pada {formatDateTime(item.scannedAt)}
              {item.scannedBy ? ` oleh ${item.scannedBy.fullName}` : ''}.
            </Alert>
          ) : null}
          {item.result === 'UNREGISTERED' ? (
            <Alert variant="error">{item.note ?? 'Barang ini tidak termasuk dalam sesi.'}</Alert>
          ) : null}

          {countable ? (
            <>
              <p className="text-sm text-muted-foreground">
                Kondisi tercatat: {item.expectedCondition ? CONDITION_LABEL[item.expectedCondition] : '-'}
              </p>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Kondisi saat ini</legend>
                <div className="grid grid-cols-2 gap-2">
                  {ASSET_CONDITIONS.map((c) => (
                    <label
                      key={c}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                        condition === c ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <input
                        type="radio"
                        name="opname-condition"
                        value={c}
                        checked={condition === c}
                        onChange={() => setCondition(c)}
                      />
                      {CONDITION_LABEL[c]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field>
                <Label htmlFor="opname-note">Catatan</Label>
                <Input id="opname-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
              </Field>
              <Button onClick={() => void save()} loading={saving} disabled={!condition}>Simpan</Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
