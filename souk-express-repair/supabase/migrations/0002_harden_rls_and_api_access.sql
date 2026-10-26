-- ============================================================================
-- 0002 - Harden RLS and lock down the Supabase Data API
--
-- Problem fixed: the policies from 0001 contained
--   current_setting('app.current_user_role', true) IS NULL
-- which means "no session context = full access". The application never sets
-- those settings, so anyone reaching the database through the Supabase Data
-- API (PostgREST) with the public anon key was effectively allowed to read and
-- modify ALL orders (names, phones, addresses) and see unapproved shops.
--
-- The Next.js server connects with DATABASE_URL (table owner / BYPASSRLS), so
-- it is not affected by these policies. These rules only protect the Data API.
-- ============================================================================

-- Orders: no session context => NO access (NULL comparisons evaluate to NULL/false)
DROP POLICY IF EXISTS role_scoped_orders_policy ON orders;
CREATE POLICY role_scoped_orders_policy ON orders FOR ALL USING (
  current_setting('app.current_user_role', true) = 'admin'
  OR customer_id::text = current_setting('app.current_user_id', true)
  OR driver_id::text = current_setting('app.current_user_id', true)
  OR shop_id IN (
    SELECT id FROM shops WHERE owner_id::text = current_setting('app.current_user_id', true)
  )
);

-- Shops: public sees approved shops only; owners/admin see their own
DROP POLICY IF EXISTS public_read_shops ON shops;
CREATE POLICY public_read_shops ON shops FOR SELECT USING (
  is_approved = true
  OR current_setting('app.current_user_role', true) = 'admin'
  OR owner_id::text = current_setting('app.current_user_id', true)
);

-- Products: only those of approved shops (or the owner's / admin's)
DROP POLICY IF EXISTS public_read_products ON products;
CREATE POLICY public_read_products ON products FOR SELECT USING (
  shop_id IN (SELECT id FROM shops WHERE is_approved = true)
  OR current_setting('app.current_user_role', true) = 'admin'
  OR shop_id IN (
    SELECT id FROM shops WHERE owner_id::text = current_setting('app.current_user_id', true)
  )
);

-- Promotions: active ones only (inactive codes must not be enumerable)
DROP POLICY IF EXISTS public_read_promotions ON promotions;
CREATE POLICY public_read_promotions ON promotions FOR SELECT USING (is_active = true);

-- Zones: active ones only
DROP POLICY IF EXISTS public_read_zones ON service_zones;
CREATE POLICY public_read_zones ON service_zones FOR SELECT USING (
  is_active = true OR current_setting('app.current_user_role', true) = 'admin'
);

-- Defense in depth: this app never uses the Supabase Data API, so remove its
-- table privileges entirely (roles only exist on Supabase, hence the guards).
DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;
