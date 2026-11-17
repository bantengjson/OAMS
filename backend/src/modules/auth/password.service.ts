import { BadRequestException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';

export const WEAK_PASSWORD_MESSAGE =
  'Password minimal 8 karakter dan mengandung huruf serta angka.';

const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Throws 400 unless the password has >= 8 chars with at least one letter and one digit. */
  assertStrong(plain: string): void {
    if (!STRONG_PASSWORD.test(plain)) {
      throw new BadRequestException(WEAK_PASSWORD_MESSAGE);
    }
  }
}
