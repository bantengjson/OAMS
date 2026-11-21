import { describe, expect, it } from 'vitest';
import { profileNameSchema } from './profile-name-form';
import { avatarFileProblem } from './profile-photo';

describe('profile name', () => {
  it('tidies spaces before checking the length', () => {
    expect(profileNameSchema.parse({ fullName: '  Budi   Santoso ' })).toEqual({ fullName: 'Budi Santoso' });
    expect(profileNameSchema.safeParse({ fullName: '   ' }).success).toBe(false);
    expect(profileNameSchema.safeParse({ fullName: 'B' }).success).toBe(false);
    expect(profileNameSchema.safeParse({ fullName: 'x'.repeat(151) }).success).toBe(false);
  });
});

describe('profile photo', () => {
  it('takes JPG, PNG and WebP up to 5 MB', () => {
    expect(avatarFileProblem({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(avatarFileProblem({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull();
    expect(avatarFileProblem({ type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG, atau WebP/);
    expect(avatarFileProblem({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});
