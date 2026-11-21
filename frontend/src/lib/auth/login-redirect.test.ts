import { describe, expect, it } from 'vitest';
import { loginRedirect } from './login-redirect';

describe('loginRedirect', () => {
  it('keeps the query string so a shared filtered link survives the login', () => {
    expect(loginRedirect('/assets', '?condition=MAJOR_DAMAGE&page=2')).toBe('/login?next=%2Fassets%3Fcondition%3DMAJOR_DAMAGE%26page%3D2');
    expect(loginRedirect('/dashboard', '')).toBe('/login?next=%2Fdashboard');
  });
});
