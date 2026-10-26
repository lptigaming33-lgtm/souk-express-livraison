# Security notes

## Changes from the first repair (kept intact)

- Demo seeding is opt-in via `SEED_DEMO_DATA=true` and disabled in production.
- The public auth endpoint no longer returns demo profile details unless local demo mode is explicitly enabled.
- Demo account switching is denied in production.
- Inactive profiles cannot log in.
- Signup requires a 12-character minimum password.
- Passwords use salted scrypt hashes instead of a fast, unsalted HMAC digest.
- Production session signing requires `AUTH_SECRET` with at least 32 characters.
- Session cookies are marked Secure in production.
- A one-time `npm run create-admin` script provisions the first admin without exposing an admin signup route, and refuses to run if an admin already exists.

## Changes in the second repair (this pass)

Order workflow
- Fixed loyalty farming: re-sending `{"status":"delivered"}` on an already delivered order re-ran the delivery side effects (+1 stamp, +20 points each time, COD overwritten). Same-status requests are now a no-op and the status update is a compare-and-swap.
- Admin `assign_driver` bypassed the state machine (it could reset a delivered/cancelled/rejected order to "assigned"). It now validates the transition, requires an active driver and runs in a transaction.
- Order creation, delivery, cancellation and COD settlement now run in database transactions.
- Loyalty redemption is atomic (`stamps_count >= 10` checked in the UPDATE), the 10 stamps / promo use are given back when an order is rejected or cancelled, and a promo only counts as used if its minimum order was reached.
- Order numbers were `SE-` + 7,900 possible values with a UNIQUE constraint (collisions after a few hundred orders). They now use 900,000 values with automatic retry.
- Idempotency keys only resolve to the caller's own order (previously another customer's order could be returned).
- Only `customer` accounts can place orders; input lengths are capped; internal errors are no longer echoed to clients.
- Customers no longer receive commission / partner payout / driver earning fields; the orders list no longer queries every driver.
- Driver cash discrepancies (collected != expected) are written into the COD note.

Database
- `0002_harden_rls_and_api_access.sql` removes the "no session context = full access" RLS bypass from `0001` (anyone with the Supabase anon key could read/modify orders through the Data API) and revokes `anon`/`authenticated` table privileges.
- `npm run db:migrate` is the only supported way to build the schema (`drizzle-kit push` skips CHECK constraints and RLS). The old `drizzle.config.json` with hardcoded `postgres:postgres` credentials was replaced by `drizzle.config.ts` reading `DATABASE_URL`.
- `DATABASE_CA_CERT` keeps TLS verification on for Supabase; the build no longer crashes when `DATABASE_URL` is absent.

Other
- CSV export neutralises spreadsheet formula injection and is `no-store`; catalog hides products of unapproved shops; login equalises timing for unknown emails; security headers added; `.gitignore` added; unused `NEXT_PUBLIC_SUPABASE_*` variables removed; `tsconfig.tsbuildinfo` removed.
- `npm run create-driver` provisions real drivers (there was no way to create them outside demo seeding).
- Tests now run the real `src/lib/business-logic.ts` (previously they re-implemented the old HMAC hashing and a hardcoded fallback secret, so they proved nothing about the app).

## Verification status (honest)

Verified in a sandbox WITHOUT network access:
- `node --check` on all `.mjs` scripts and the service worker: pass.
- `npm test`: 13 pass, 1 skipped (database test needs `TEST_DATABASE_URL`), 0 fail.
- Syntax-only TypeScript parse of all 28 `.ts/.tsx` files: 0 syntax errors.

NOT verified (dependencies could not be installed): `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`, running the app, running the migrations against a real PostgreSQL, the database integration test. There is no lockfile: run `npm install` once and commit `package-lock.json`.
