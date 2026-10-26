import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Applies supabase/migrations/*.sql in order, each inside a transaction, and
// records what ran. This is the ONLY supported way to build the production
// schema: `drizzle-kit push` would skip the CHECK constraints and RLS policies.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const ssl = process.env.DATABASE_CA_CERT
  ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
  : undefined;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl });
await client.connect();
try {
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT NOW()
     )`
  );
  // Keep the bookkeeping table private too (RLS on, no policies).
  await client.query("ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY");

  const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      process.stdout.write(`skip     ${file}\n`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      process.stdout.write(`applied  ${file}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
