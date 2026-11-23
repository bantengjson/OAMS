import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRefreshAction } from './use-refresh-action';

describe('useRefreshAction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is idle until it runs', () => {
    const { result } = renderHook(() => useRefreshAction(async () => undefined));
    expect(result.current.refreshing).toBe(false);
  });

  it('stays busy long enough to be seen, even when the work finishes at once', async () => {
    const { result } = renderHook(() => useRefreshAction(async () => undefined, 600));
    act(() => void result.current.run());
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('keeps spinning while slow work is still running', async () => {
    let finish = () => undefined as void;
    const work = () => new Promise<void>((resolve) => (finish = resolve));
    const { result } = renderHook(() => useRefreshAction(work, 100));
    act(() => void result.current.run());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      finish();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.refreshing).toBe(false);
  });

  it('ignores a second press while it is still running', async () => {
    const work = vi.fn(async () => undefined);
    const { result } = renderHook(() => useRefreshAction(work, 600));
    act(() => void result.current.run());
    act(() => void result.current.run());
    expect(work).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    act(() => void result.current.run());
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('stops spinning when the work fails', async () => {
    const { result } = renderHook(() => useRefreshAction(async () => Promise.reject(new Error('mati')), 100));
    act(() => void result.current.run());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.refreshing).toBe(false);
  });
});
