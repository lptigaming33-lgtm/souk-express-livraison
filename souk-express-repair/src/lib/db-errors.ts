/**
 * Extract the PostgreSQL error code / constraint name from an error thrown by
 * `pg` or wrapped by drizzle-orm (which keeps the original error in `cause`).
 */
export function pgErrorInfo(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return {};
}

export function isUniqueViolation(error: unknown, constraintHint?: string): boolean {
  const info = pgErrorInfo(error);
  if (info.code !== "23505") return false;
  if (!constraintHint) return true;
  return (info.constraint ?? "").includes(constraintHint);
}
