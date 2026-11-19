'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { assetsApi } from '@/lib/api/assets';
import { STATUS_LABEL } from '@/lib/asset-labels';
import type { AssetListItem } from '@/types/api';

/**
 * Picks one active (non-archived) asset by code or name and hands the parent
 * the full list item, so forms can show the current location and responsible.
 */
export function AssetPicker({
  value,
  onChange,
  id,
  invalid,
  disabled,
}: {
  value: AssetListItem | null;
  onChange: (asset: AssetListItem | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(term);
  const results = useQuery({
    queryKey: ['assets', 'picker', debounced],
    queryFn: () => assetsApi.list({ search: debounced || undefined, pageSize: 20 }),
    enabled: open,
  });

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-md border border-input bg-card px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="font-mono text-xs text-muted-foreground">{value.assetCode}</span> · {value.name}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={value.location.path}>
            {value.location.path}
          </p>
          <p className="text-xs text-muted-foreground">
            PJ: {value.responsibleEmployee?.fullName ?? '-'} · {STATUS_LABEL[value.status]}
          </p>
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Ganti barang"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cari kode atau nama barang..."
        autoComplete="off"
        aria-invalid={invalid}
        aria-controls={listId}
        aria-expanded={open}
        disabled={disabled}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {results.isPending ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Memuat...</li>
          ) : results.data?.data.length ? (
            results.data.data.map((a) => (
              <li key={a.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(a);
                    setTerm('');
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">
                    <span className="font-mono text-xs text-muted-foreground">{a.assetCode}</span> · {a.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.location.path} · {STATUS_LABEL[a.status]}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada barang cocok.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
