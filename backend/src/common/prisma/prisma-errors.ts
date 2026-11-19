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

/** Serialization failure under Serializable isolation (`P2034`): safe to retry once. */
export function isSerializationFailure(error: unknown): boolean {
  return prismaErrorCode(error) === 'P2034';
}
