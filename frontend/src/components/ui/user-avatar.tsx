'use client';

import { useQuery } from '@tanstack/react-query';
import { useObjectUrl } from '@/hooks/use-object-url';
import { fetchBlob } from '@/lib/api/client';
import { cn, initials } from '@/lib/utils';

const SIZE = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  xl: 'h-28 w-28 text-3xl',
} as const;

/**
 * Round profile photo; shows the initials when there is no photo, while it loads, or when it fails.
 * `avatarUrl` is an API path that needs the bearer token, so the image is fetched as a blob.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = 'sm',
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const apiPath = avatarUrl ? avatarUrl.replace(/^\/api\/v1/, '') : null;
  const blob = useQuery({
    queryKey: ['blob', apiPath],
    queryFn: () => fetchBlob(apiPath!),
    enabled: Boolean(apiPath),
    staleTime: Infinity,
    retry: false,
  });
  const url = useObjectUrl(apiPath ? blob.data : null);

  const base = cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full', SIZE[size], className);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- object URLs cannot go through next/image
    return <img src={url} alt={`Foto ${name}`} className={cn(base, 'object-cover')} />;
  }
  return (
    <span className={cn(base, 'bg-primary-soft font-semibold text-primary')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
