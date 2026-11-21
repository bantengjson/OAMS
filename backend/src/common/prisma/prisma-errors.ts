/** Error-code helpers for Prisma known request errors (no class import needed). */

export function prismaErrorCode(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== 'PrismaClientKnownRequestError') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Unique-constraint violation (`P2002`); `index` narrows to one named index when given. */
export function isUniqueViolation(error: unknown, index?: string): boolean {
  if (prismaErrorCode(error) !== 'P2002') return false;
  if (!index) return true;
  return JSON.stringify((error as { meta?: unknown }).meta ?? {}).includes(index);
}

/**
 * Serialization failure under Serializable isolation: safe to retry once. Prisma queries report
 * it as `P2034`; a raw query (such as a row lock) as `P2010` carrying Postgres code `40001`.
 */
export function isSerializationFailure(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === 'P2034') return true;
  if (code !== 'P2010') return false;
  const meta = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } }).meta;
  return meta?.driverAdapterError?.cause?.originalCode === '40001';
}
