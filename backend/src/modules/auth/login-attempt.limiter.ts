import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export const LOGIN_LOCKED_MESSAGE = 'Terlalu banyak percobaan login. Coba lagi dalam satu menit.';
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 60_000;

/**
 * Per-account brute-force guard: at most 5 failed logins per minute per
 * normalised email, whatever the client address. Complements the per-IP
 * throttler, which must stay loose because a whole office shares one NAT
 * address. In-memory on purpose: the blueprint runs a single backend node.
 */
@Injectable()
export class LoginAttemptLimiter {
  private readonly failures = new Map<string, number[]>();

  assertAllowed(key: string, now = Date.now()): void {
    if (this.recent(key, now).length >= LOGIN_MAX_FAILURES) {
      throw new HttpException(LOGIN_LOCKED_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  recordFailure(key: string, now = Date.now()): void {
    const list = this.recent(key, now);
    list.push(now);
    this.failures.set(key, list);
    if (this.failures.size > 10_000) this.sweep(now);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
    if (list.length === 0) this.failures.delete(key);
    return list;
  }

  private sweep(now: number): void {
    for (const key of Array.from(this.failures.keys())) this.recent(key, now);
  }
}
