import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useObjectUrl } from './use-object-url';

describe('useObjectUrl', () => {
  const revoked = new Set<string>();
  let n = 0;
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: () => `blob:test/${++n}`,
    revokeObjectURL: (u: string) => void revoked.add(u),
  }));
  afterEach(() => revoked.clear());

  it('never hands out a revoked URL, even when effects run twice (dev mode)', () => {
    const blob = new Blob(['x']);
    const { result } = renderHook(() => useObjectUrl(blob), { wrapper: StrictMode });
    expect(result.current).toMatch(/^blob:test\//);
    expect(revoked.has(result.current!)).toBe(false);
  });

  it('revokes the URL when the blob goes away', () => {
    const blob = new Blob(['x']);
    const { result, rerender } = renderHook(({ b }) => useObjectUrl(b), { initialProps: { b: blob as Blob | null } });
    const first = result.current!;
    rerender({ b: null });
    expect(result.current).toBeNull();
    expect(revoked.has(first)).toBe(true);
  });
});
