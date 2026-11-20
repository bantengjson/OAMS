import { ConflictException } from '@nestjs/common';
import { AssetStateGuard, restorableStatus } from './asset-state.guard.js';
import type { AssetState } from './asset-state.guard.js';

const free: AssetState = {
  id: 'a1',
  status: 'IN_USE',
  archivedAt: null,
  activeLoanId: null,
  pendingMutationId: null,
  openMaintenance: null,
  activeDisposalId: null,
};

const message = (fn: () => void): string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConflictException) return e.message;
    throw e;
  }
  return 'no error';
};

describe('restorableStatus', () => {
  it('keeps a manual status', () => {
    expect(restorableStatus('IN_USE')).toBe('IN_USE');
    expect(restorableStatus('STORED')).toBe('STORED');
  });

  it('falls back to AVAILABLE for flow-managed statuses', () => {
    for (const s of ['BORROWED', 'RETURNED', 'UNDER_MAINTENANCE', 'MISSING', 'DISPOSED'] as const) {
      expect(restorableStatus(s)).toBe('AVAILABLE');
    }
  });
});

describe('AssetStateGuard.assertFree', () => {
  const guard = new AssetStateGuard(null as never);

  it('passes a free asset', () => {
    expect(message(() => guard.assertFree(free))).toBe('no error');
  });

  it('reports blockers in priority order', () => {
    const all: AssetState = {
      ...free,
      archivedAt: new Date(),
      activeDisposalId: 'd',
      activeLoanId: 'l',
      openMaintenance: { id: 'm', status: 'IN_PROGRESS' },
      pendingMutationId: 'p',
    };
    expect(message(() => guard.assertFree(all))).toBe('Barang sudah diarsipkan.');
    expect(message(() => guard.assertFree({ ...all, archivedAt: null }))).toBe('Barang sudah dilepas.');
    expect(message(() => guard.assertFree({ ...all, archivedAt: null, activeDisposalId: null }))).toBe(
      'Barang sedang dipinjam.',
    );
    expect(
      message(() => guard.assertFree({ ...all, archivedAt: null, activeDisposalId: null, activeLoanId: null })),
    ).toBe('Barang sedang diperbaiki.');
    expect(message(() => guard.assertFree({ ...free, pendingMutationId: 'p' }))).toBe(
      'Sudah ada mutasi yang menunggu persetujuan.',
    );
  });

  it('only counts maintenance that is in progress', () => {
    expect(message(() => guard.assertFree({ ...free, openMaintenance: { id: 'm', status: 'REPORTED' } }))).toBe(
      'no error',
    );
  });

  it('skips blockers listed in allow', () => {
    expect(message(() => guard.assertFree({ ...free, pendingMutationId: 'p' }, ['pendingMutation']))).toBe('no error');
    expect(message(() => guard.assertFree({ ...free, activeLoanId: 'l' }, ['borrowed']))).toBe('no error');
  });
});
