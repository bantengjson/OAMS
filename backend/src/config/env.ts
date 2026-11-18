import { z } from 'zod';

const booleanString = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: booleanString.optional(),
  APP_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
  /** Base URL encoded into QR codes, e.g. https://inventaris.kantor.go.id */
  PUBLIC_BASE_URL: z.url().optional(),
  /** Folder for uploaded photos/documents (absolute or relative to backend/). */
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_USERNAME: z
    .string()
    .regex(/^[a-z0-9._-]{3,50}$/i)
    .optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().min(1).optional(),
});

type RawEnv = z.infer<typeof envSchema>;

export type Env = Omit<RawEnv, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

/**
 * Parses and validates process environment. Throws with every offending key
 * listed so a misconfigured deployment fails fast and legibly.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Konfigurasi environment tidak valid: ${details}`);
  }
  const parsed = result.data;
  return {
    ...parsed,
    COOKIE_SECURE: parsed.COOKIE_SECURE ?? parsed.NODE_ENV === 'production',
  };
}
