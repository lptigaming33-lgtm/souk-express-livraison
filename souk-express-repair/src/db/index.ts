import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// `next build` imports route modules to collect metadata; only enforce the
// variable at runtime so a build without a database still succeeds.
if (!databaseUrl && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("DATABASE_URL is required");
}

// Supabase presents a certificate signed by its own CA. Provide it through
// DATABASE_CA_CERT (PEM contents) to keep full TLS verification enabled.
const ssl = process.env.DATABASE_CA_CERT
  ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
  : undefined;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
