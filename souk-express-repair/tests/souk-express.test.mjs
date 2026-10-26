// Tests run the REAL application code (src/lib/business-logic.ts) through Node's
// built-in TypeScript type stripping (Node >= 22.18). Nothing is re-implemented here.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.AUTH_SECRET = "test-only-secret-0123456789-abcdefghijklmnop";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  canUserAccessOrder,
  calculateOrderFinancials,
  validateOrderStatusTransition,
  calculateCodAccounting,
} = await import("../src/lib/business-logic.ts");

const item = (over = {}) => ({
  productId: 1,
  productNameFr: "Tajine",
  productNameAr: "طاجين",
  authoritativeUnitPriceMad: 50,
  quantity: 2,
  isAvailable: true,
  ...over,
});
const base = (over = {}) => ({
  items: [item()],
  zoneDeliveryFeeMad: 15,
  zoneDriverPayoutMad: 12,
  shopCommissionRatePercent: 15,
  ...over,
});

test("1a. Passwords: salted scrypt, no two hashes alike, wrong password and malformed hashes rejected", () => {
  const h1 = hashPassword("correct horse battery");
  const h2 = hashPassword("correct horse battery");
  assert.match(h1, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(h1, h2, "each hash must use its own random salt");
  assert.equal(verifyPassword("correct horse battery", h1), true);
  assert.equal(verifyPassword("wrong password!!", h1), false);
  assert.equal(verifyPassword("x", "not-a-hash"), false);
  assert.equal(verifyPassword("x", "scrypt$zz$zz"), false);
  // legacy unsalted HMAC digests (64 hex chars) must no longer be accepted
  assert.equal(verifyPassword("x", crypto.createHmac("sha256", "k").update("x").digest("hex")), false);
});

test("1b. Sessions: valid token round-trips, tampering/expiry/garbage rejected", () => {
  const token = createSessionToken({ userId: 7, email: "a@b.co", role: "customer", fullName: "A B" });
  assert.equal(verifySessionToken(token)?.userId, 7);

  const [data, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url")), role: "admin" })).toString("base64url");
  assert.equal(verifySessionToken(`${forged}.${sig}`), null, "role escalation via payload edit must fail");
  assert.equal(verifySessionToken(`${data}.${sig}x`), null);
  assert.equal(verifySessionToken(undefined), null);
  assert.equal(verifySessionToken("garbage"), null);

  const expiredData = Buffer.from(JSON.stringify({ userId: 1, email: "a@b.co", role: "admin", fullName: "x", exp: Date.now() - 1000 })).toString("base64url");
  const expiredSig = crypto.createHmac("sha256", process.env.AUTH_SECRET).update(expiredData).digest("base64url");
  assert.equal(verifySessionToken(`${expiredData}.${expiredSig}`), null, "expired token must be rejected");
});

test("1c. Production refuses to sign sessions without a strong AUTH_SECRET", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.AUTH_SECRET;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;
    assert.throws(() => createSessionToken({ userId: 1, email: "a@b.co", role: "customer", fullName: "x" }), /AUTH_SECRET/);
    process.env.AUTH_SECRET = "too-short";
    assert.throws(() => createSessionToken({ userId: 1, email: "a@b.co", role: "customer", fullName: "x" }), /AUTH_SECRET/);
  } finally {
    process.env.NODE_ENV = prevEnv;
    process.env.AUTH_SECRET = prevSecret;
  }
});

test("2. RBAC: nobody can access another user's order", () => {
  const order = { customerId: 10, driverId: 20, shopOwnerId: 30 };
  assert.equal(canUserAccessOrder({ id: 10, role: "customer" }, order), true);
  assert.equal(canUserAccessOrder({ id: 11, role: "customer" }, order), false);
  assert.equal(canUserAccessOrder({ id: 20, role: "driver" }, order), true);
  assert.equal(canUserAccessOrder({ id: 21, role: "driver" }, order), false);
  assert.equal(canUserAccessOrder({ id: 30, role: "partner" }, order), true);
  assert.equal(canUserAccessOrder({ id: 31, role: "partner" }, order), false);
  assert.equal(canUserAccessOrder({ id: 99, role: "admin" }, order), true);
  assert.equal(canUserAccessOrder({ id: 20, role: "driver" }, { ...order, driverId: null }), false);
});

test("3a. Pricing: server prices, commission, delivery fee, totals in MAD", () => {
  const r = calculateOrderFinancials(base());
  assert.equal(r.subtotalMad, 100);
  assert.equal(r.deliveryFeeMad, 15);
  assert.equal(r.totalMad, 115);
  assert.equal(r.commissionMad, 15);
  assert.equal(r.partnerPayoutMad, 85);
  assert.equal(r.driverEarningMad, 12);
  assert.equal(r.lineItems[0].unitPriceMadSnapshot, 50);
});

test("3b. Pricing: invalid carts are rejected", () => {
  assert.throws(() => calculateOrderFinancials(base({ items: [] })));
  assert.throws(() => calculateOrderFinancials(base({ items: [item({ quantity: 0 })] })));
  assert.throws(() => calculateOrderFinancials(base({ items: [item({ quantity: 100 })] })));
  assert.throws(() => calculateOrderFinancials(base({ items: [item({ quantity: -3 })] })));
  assert.throws(() => calculateOrderFinancials(base({ items: [item({ isAvailable: false })] })));
  assert.throws(() => calculateOrderFinancials(base({ items: [item({ authoritativeUnitPriceMad: -5 })] })));
});

test("3c. Promo only applies above its minimum; loyalty needs 10 stamps; discount can never exceed the bill", () => {
  assert.equal(calculateOrderFinancials(base({ promoDiscountMad: 20, promoMinOrderMad: 150 })).discountMad, 0);
  assert.equal(calculateOrderFinancials(base({ promoDiscountMad: 20, promoMinOrderMad: 50 })).discountMad, 20);

  const noReward = calculateOrderFinancials(base({ redeemLoyaltyTenStamps: true, customerStampsCount: 9 }));
  assert.equal(noReward.loyaltyRewardApplied, false);
  const reward = calculateOrderFinancials(base({ redeemLoyaltyTenStamps: true, customerStampsCount: 10 }));
  assert.equal(reward.loyaltyRewardApplied, true);
  assert.equal(reward.discountMad, 25);

  const capped = calculateOrderFinancials(base({ promoDiscountMad: 500, promoMinOrderMad: 0 }));
  assert.equal(capped.totalMad, 0);
  assert.ok(capped.discountMad <= capped.subtotalMad + capped.deliveryFeeMad);
});

test("4. Order state machine and role enforcement", () => {
  const v = (a, b, role) => validateOrderStatusTransition(a, b, role).valid;
  assert.equal(v("pending", "accepted", "partner"), true);
  assert.equal(v("pending", "accepted", "customer"), false);
  assert.equal(v("pending", "cancelled", "customer"), true);
  assert.equal(v("accepted", "cancelled", "customer"), false, "customer cannot cancel once the shop accepted");
  assert.equal(v("assigned", "picked_up", "driver"), true);
  assert.equal(v("picked_up", "on_the_way", "driver"), true);
  assert.equal(v("on_the_way", "delivered", "driver"), true);
  assert.equal(v("on_the_way", "delivered", "customer"), false);
  assert.equal(v("on_the_way", "delivered", "partner"), false);
  for (const terminal of ["delivered", "rejected", "cancelled"]) {
    for (const next of ["pending", "accepted", "assigned", "delivered"]) {
      if (next !== terminal) assert.equal(v(terminal, next, "admin"), false, `${terminal} -> ${next} must be impossible`);
    }
  }
  assert.equal(v("picked_up", "assigned", "admin"), false, "an order in transit cannot be re-assigned backwards");
});

test("5. COD accounting", () => {
  const s = calculateCodAccounting([
    { driverId: 1, expectedAmountMad: 100, collectedAmountMad: 0, driverEarningMad: 12, status: "pending" },
    { driverId: 1, expectedAmountMad: 80, collectedAmountMad: 80, driverEarningMad: 12, status: "collected" },
    { driverId: 1, expectedAmountMad: 60, collectedAmountMad: 60, driverEarningMad: 10, status: "remitted_to_admin" },
  ]);
  assert.equal(s.pendingExpectedMad, 100);
  assert.equal(s.cashInHandByDriversMad, 80);
  assert.equal(s.remittedToAdminMad, 60);
  assert.equal(s.totalCollectedMad, 140);
  assert.equal(s.totalDriverEarningsMad, 22);
  assert.equal(s.completedDeliveriesCount, 2);
});

// ---------------------------------------------------------------------------
// Static regression guards: cheap protection for the security fixes in this repair.
// ---------------------------------------------------------------------------
test("6a. Regression: re-sending the current status never re-runs delivery side effects", () => {
  const src = read("src/app/api/orders/[id]/route.ts");
  const noop = src.indexOf("nextStatus === order.status");
  const tx = src.indexOf("db.transaction");
  assert.ok(noop > 0 && tx > noop, "same-status no-op must come before the transaction");
  assert.match(src, /eq\(orders\.status, order\.status\)/, "status update must be compare-and-swap");
});

test("6b. Regression: no 'no session context = allow' RLS bypass in the final policies", () => {
  const fixed = read("supabase/migrations/0002_harden_rls_and_api_access.sql").replace(/--.*$/gm, "");
  assert.ok(!/IS NULL/i.test(fixed), "0002 policies must not grant access when session settings are unset");
  assert.match(fixed, /REVOKE ALL ON ALL TABLES IN SCHEMA public/);
});

test("6c. Regression: demo seeding & demo login are disabled in production", () => {
  assert.match(read("src/lib/seed.ts"), /NODE_ENV === "production"/);
  assert.match(read("src/app/api/auth/route.ts"), /NODE_ENV === "production"/);
});

test("6d. Regression: server secrets are never NEXT_PUBLIC_ and no .env is shipped", () => {
  const env = read(".env.example");
  assert.ok(!/NEXT_PUBLIC_(AUTH|DATABASE|SERVICE|ADMIN)/.test(env));
  assert.ok(!fs.existsSync(path.join(root, ".env")), ".env must not be committed or zipped");
  assert.match(read(".gitignore"), /^\.env$/m);
});

// ---------------------------------------------------------------------------
// Optional database integration test. Runs ONLY when TEST_DATABASE_URL is set
// (a scratch database where `npm run db:migrate` was already applied).
// It is read-only and never touches DATABASE_URL.
// ---------------------------------------------------------------------------
test("7. Database schema, constraints and RLS (needs TEST_DATABASE_URL)", { skip: !process.env.TEST_DATABASE_URL && "TEST_DATABASE_URL not set" }, async () => {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map((r) => r.table_name);
    for (const t of ["addresses", "cod_records", "driver_assignments", "loyalty_records", "order_items", "orders", "products", "profiles", "promotions", "service_zones", "shops"]) {
      assert.ok(tables.includes(t), `table ${t} missing`);
    }

    const rls = await client.query("SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname <> 'schema_migrations'");
    for (const r of rls.rows) assert.equal(r.relrowsecurity, true, `RLS disabled on ${r.relname}`);

    const policies = await client.query("SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname='public'");
    for (const p of policies.rows) {
      assert.ok(!/IS NULL/i.test(p.qual ?? ""), `policy ${p.policyname} on ${p.tablename} still allows access without session context`);
    }

    const checks = await client.query("SELECT conrelid::regclass::text AS tbl FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace");
    const withChecks = new Set(checks.rows.map((r) => r.tbl));
    for (const t of ["orders", "loyalty_records", "cod_records", "products"]) assert.ok(withChecks.has(t), `no CHECK constraints on ${t}`);

    const idx = await client.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='orders'");
    assert.ok(idx.rows.some((r) => /UNIQUE.*idempotency_key/i.test(r.indexdef)), "idempotency_key must be unique");
    assert.ok(idx.rows.some((r) => /UNIQUE.*order_number/i.test(r.indexdef)), "order_number must be unique");

    const roles = await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')");
    for (const { rolname } of roles.rows) {
      const grants = await client.query("SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE grantee=$1 AND table_schema='public'", [rolname]);
      assert.equal(grants.rows[0].n, 0, `${rolname} must have no table privileges`);
    }
  } finally {
    await client.end();
  }
});
