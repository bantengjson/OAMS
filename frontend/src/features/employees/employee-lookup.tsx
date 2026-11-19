'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { employeesApi } from '@/lib/api/employees';

/**
 * Picks one active employee. Keeps the chosen id in the parent; shows the chosen
 * name here. Typing searches by name or employee number.
 */
export function EmployeeLookup({
  value,
  label,
  onChange,
  id,
  invalid,
  placeholder = 'Cari nama atau nomor pegawai...',
  clearLabel = 'Hapus pilihan',
}: {
  value: string;
  /** Display name of the current value (from a detail payload or a previous pick). */
  label: string | null;
  onChange: (id: string, label: string | null, departmentId?: string | null) => void;
  id?: string;
  invalid?: boolean;
  placeholder?: string;
  clearLabel?: string;
}) {
  const listId = useId();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(term);
  const results = useQuery({
    queryKey: ['employees', 'lookup', debounced],
    queryFn: () => employeesApi.lookup(debounced || undefined),
    enabled: open,
  });

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-md border border-input bg-card px-3 text-sm">
        <span className="truncate">{label ?? 'Pegawai terpilih'}</span>
        <button
          type="button"
          onClick={() => onChange('', null, null)}
          className="ml-2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </button>
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
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid}
        aria-controls={listId}
        aria-expanded={open}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {results.isPending ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Memuat...</li>
          ) : results.data?.length ? (
            results.data.map((e) => (
              <li key={e.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    onChange(e.id, e.fullName, e.department?.id ?? null);
                    setTerm('');
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{e.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {[e.employeeNumber, e.department?.name].filter(Boolean).join(' · ') || 'Tanpa nomor pegawai'}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada pegawai cocok.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
