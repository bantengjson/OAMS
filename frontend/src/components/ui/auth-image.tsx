'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { fetchBlob } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/**
 * <img> for API paths that require the bearer token: fetches the blob and
 * shows it through an object URL (revoked when the component unmounts).
 */
export function AuthImage({
  path,
  className,
  alt,
  ...props
}: { path: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const apiPath = path.replace(/^\/api\/v1/, '');
  const blob = useQuery({ queryKey: ['blob', apiPath], queryFn: () => fetchBlob(apiPath), staleTime: 300_000 });
  const url = useMemo(() => (blob.data ? URL.createObjectURL(blob.data) : null), [blob.data]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!url) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted text-xs text-muted-foreground', className)}
        aria-busy={blob.isPending}
      >
        {blob.isError ? 'Gagal memuat' : '...'}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- object URLs cannot go through next/image
  return <img src={url} alt={alt ?? ''} className={className} {...props} />;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
