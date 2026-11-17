import { Injectable } from '@nestjs/common';
import type { Env } from './env.js';

@Injectable()
export class EnvService {
  constructor(private readonly env: Env) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get all(): Env {
    return this.env;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
