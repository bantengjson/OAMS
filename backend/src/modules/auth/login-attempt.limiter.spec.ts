import { HttpException } from '@nestjs/common';
import { LOGIN_LOCKED_MESSAGE, LoginAttemptLimiter } from './login-attempt.limiter.js';

describe('LoginAttemptLimiter', () => {
  it('allows up to five failures and blocks the sixth within a minute', () => {
    const limiter = new LoginAttemptLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      limiter.assertAllowed('a@x', t0 + i);
      limiter.recordFailure('a@x', t0 + i);
    }
    expect(() => limiter.assertAllowed('a@x', t0 + 10)).toThrow(HttpException);
    expect(() => limiter.assertAllowed('a@x', t0 + 10)).toThrow(LOGIN_LOCKED_MESSAGE);
    // other accounts are unaffected
    expect(() => limiter.assertAllowed('b@x', t0 + 10)).not.toThrow();
  });

  it('forgets failures older than the window and after a reset', () => {
    const limiter = new LoginAttemptLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('a@x', t0);
    expect(() => limiter.assertAllowed('a@x', t0 + 60_001)).not.toThrow();

    for (let i = 0; i < 5; i += 1) limiter.recordFailure('c@x', t0);
    limiter.reset('c@x');
    expect(() => limiter.assertAllowed('c@x', t0 + 1)).not.toThrow();
  });
});
