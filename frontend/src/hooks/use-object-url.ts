'use client';

import { useEffect, useState } from 'react';

/**
 * An object URL for a blob, revoked when the blob changes or the component unmounts.
 * Created inside the effect (not in render) so a re-run effect never leaves a revoked URL on screen.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // The URL is an external resource that must be created and revoked in the same effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return blob && entry?.blob === blob ? entry.url : null;
}
