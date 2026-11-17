import { BadRequestException } from '@nestjs/common';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id', async () => {
    const hash = await service.hash('Test1234');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a matching password and rejects a wrong one', async () => {
    const hash = await service.hash('Test1234');
    expect(await service.verify(hash, 'Test1234')).toBe(true);
    expect(await service.verify(hash, 'Test1235')).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await service.verify('not-a-hash', 'Test1234')).toBe(false);
  });

  it.each(['abcdefgh', '12345678', 'Ab1', ''])('rejects weak password %j', (weak) => {
    expect(() => service.assertStrong(weak)).toThrow(BadRequestException);
    expect(() => service.assertStrong(weak)).toThrow(
      'Password minimal 8 karakter dan mengandung huruf serta angka.',
    );
  });

  it('accepts a password with letters and digits of at least 8 characters', () => {
    expect(() => service.assertStrong('Test1234')).not.toThrow();
  });
});
