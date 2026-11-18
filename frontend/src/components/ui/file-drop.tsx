'use client';

import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/asset-labels';

export function FileDrop({
  accept,
  maxBytes,
  multiple = false,
  disabled = false,
  hint,
  onFiles,
}: {
  accept: string;
  maxBytes: number;
  multiple?: boolean;
  disabled?: boolean;
  hint?: string;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      setError(`${tooBig.name} melebihi batas ${formatBytes(maxBytes)}.`);
      return;
    }
    setError(null);
    onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors',
          over ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <Upload className="h-5 w-5" aria-hidden="true" />
        <span>Tarik berkas ke sini atau klik untuk memilih</span>
        {hint ? <span className="text-xs">{hint}</span> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
