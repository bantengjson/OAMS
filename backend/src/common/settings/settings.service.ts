import { Injectable } from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SETTING_PUBLIC_BASE_URL = 'public_base_url';

/**
 * Key/value configuration stored in `system_settings`, with environment
 * variables as the fallback. Tahap 5 adds the admin UI on top of this.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : undefined;
  }

  async set(key: string, value: Prisma.InputJsonValue, actorId: string | null): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: actorId },
      create: { key, value, updatedById: actorId },
    });
  }

  /** Base URL encoded into QR codes, without a trailing slash. */
  async getPublicBaseUrl(): Promise<string> {
    const stored = await this.get<string>(SETTING_PUBLIC_BASE_URL);
    const value = (typeof stored === 'string' && stored.trim()) || this.env.get('PUBLIC_BASE_URL') || '';
    return value.replace(/\/+$/, '');
  }
}
