import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Used for `drizzle-kit studio` / introspection only. The production schema is
// built with `npm run db:migrate` (supabase/migrations/*.sql), NOT `drizzle-kit push`,
// because the SQL files carry the CHECK constraints and RLS policies.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
