'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FileDrop } from '@/components/ui/file-drop';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { assetsApi } from '@/lib/api/assets';
import { getErrorMessage } from '@/lib/api/form-errors';
import { CONDITION_LABEL } from '@/lib/asset-labels';
import { jakartaToday } from '@/lib/dates';
import { ASSET_CONDITIONS } from '@/types/api';
import type { AssetCondition } from '@/types/api';

export function ConditionLogDialog({
  assetId,
  currentCondition,
  open,
  onClose,
}: {
  assetId: string;
  currentCondition: AssetCondition;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [condition, setCondition] = useState<AssetCondition>(currentCondition);
  const [checkedAt, setCheckedAt] = useState(() => jakartaToday());
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: async () => {
      const log = await assetsApi.createConditionLog(assetId, { condition, notes: notes.trim() || null, checkedAt });
      // Photos ride on the existing upload endpoint, tagged with the new log.
      for (const file of files) await assetsApi.uploadPhoto(assetId, file, undefined, log.id);
      return log;
    },
    onSuccess: () => {
      toast.success('Pemeriksaan kondisi dicatat.');
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      setNotes('');
      setFiles([]);
      setError(null);
      onClose();
    },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Catat pemeriksaan kondisi"
      description="Kondisi barang mengikuti hasil pemeriksaan terakhir."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={act.isPending}>Batal</Button>
          <Button onClick={() => act.mutate()} loading={act.isPending}>Simpan</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="cond-condition" required>Kondisi</Label>
            <Select id="cond-condition" value={condition} onChange={(e) => setCondition(e.target.value as AssetCondition)}>
              {ASSET_CONDITIONS.map((c) => (
                <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
              ))}
            </Select>
            <FieldHint>Saat ini: {CONDITION_LABEL[currentCondition]}</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="cond-date" required>Tanggal pemeriksaan</Label>
            <Input id="cond-date" type="date" value={checkedAt} max={jakartaToday()} onChange={(e) => setCheckedAt(e.target.value)} />
          </Field>
        </div>
        <Field>
          <Label htmlFor="cond-notes">Catatan</Label>
          <Textarea id="cond-notes" rows={3} placeholder="Mis. engsel longgar, layar bergaris" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field>
          <Label>Foto kerusakan</Label>
          <FileDrop
            accept="image/jpeg,image/png,image/webp"
            maxBytes={10 * 1024 * 1024}
            multiple
            disabled={act.isPending}
            hint="Opsional. JPEG, PNG, atau WebP, maksimal 10 MB per foto; ikut tampil di galeri barang."
            onFiles={(picked) => setFiles((prev) => [...prev, ...picked])}
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
