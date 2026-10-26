-- ============================================================================
-- SOUK EXPRESS (AGADIR, MOROCCO) - PHASE 1 SCHEMA, CONSTRAINTS & RLS POLICIES
-- Currency: MAD (Moroccan Dirham) | Fleet: 4 Motorcycle Drivers | Zero-Budget
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'partner', 'admin')),
  driver_code TEXT,
  vehicle_plate TEXT,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  current_zone TEXT DEFAULT 'Talborjt',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

CREATE TABLE IF NOT EXISTS service_zones (
  id SERIAL PRIMARY KEY,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  delivery_fee_mad INTEGER NOT NULL DEFAULT 15 CHECK (delivery_fee_mad >= 0),
  driver_payout_mad INTEGER NOT NULL DEFAULT 12 CHECK (driver_payout_mad >= 0),
  estimated_mins TEXT NOT NULL DEFAULT '25-35 min',
  map_query TEXT NOT NULL DEFAULT 'Agadir, Morocco',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS service_zones_slug_idx ON service_zones(slug);

CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  image_url TEXT NOT NULL,
  address TEXT NOT NULL,
  zone_id INTEGER REFERENCES service_zones(id),
  phone TEXT NOT NULL,
  commission_rate INTEGER NOT NULL DEFAULT 15 CHECK (commission_rate BETWEEN 0 AND 100),
  prep_time_mins TEXT NOT NULL DEFAULT '20-30 min',
  rating TEXT NOT NULL DEFAULT '4.8',
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shops_owner_idx ON shops(owner_id);
CREATE INDEX IF NOT EXISTS shops_category_idx ON shops(category);
CREATE INDEX IF NOT EXISTS shops_approved_idx ON shops(is_approved);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name_fr TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  price_mad INTEGER NOT NULL CHECK (price_mad >= 0),
  category_fr TEXT NOT NULL,
  category_ar TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_shop_idx ON products(shop_id);
CREATE INDEX IF NOT EXISTS products_available_idx ON products(is_available);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Maison',
  zone_id INTEGER NOT NULL REFERENCES service_zones(id),
  street_address TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses(user_id);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title_fr TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  discount_mad INTEGER NOT NULL CHECK (discount_mad > 0),
  min_order_mad INTEGER NOT NULL DEFAULT 50 CHECK (min_order_mad >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS promotions_code_idx ON promotions(code);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES profiles(id),
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  driver_id INTEGER REFERENCES profiles(id),
  zone_id INTEGER NOT NULL REFERENCES service_zones(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'preparing', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'rejected', 'cancelled')
  ),
  idempotency_key TEXT NOT NULL UNIQUE,
  subtotal_mad INTEGER NOT NULL CHECK (subtotal_mad >= 0),
  delivery_fee_mad INTEGER NOT NULL CHECK (delivery_fee_mad >= 0),
  discount_mad INTEGER NOT NULL DEFAULT 0 CHECK (discount_mad >= 0),
  total_mad INTEGER NOT NULL CHECK (total_mad >= 0),
  commission_mad INTEGER NOT NULL DEFAULT 0,
  partner_payout_mad INTEGER NOT NULL DEFAULT 0,
  driver_earning_mad INTEGER NOT NULL DEFAULT 12,
  promo_code TEXT,
  loyalty_reward_used BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_address_snapshot TEXT NOT NULL,
  delivery_zone_snapshot TEXT NOT NULL,
  delivery_landmark_snapshot TEXT NOT NULL DEFAULT '',
  customer_name_snapshot TEXT NOT NULL,
  customer_phone_snapshot TEXT NOT NULL,
  shop_name_snapshot TEXT NOT NULL,
  shop_address_snapshot TEXT NOT NULL,
  shop_phone_snapshot TEXT NOT NULL,
  order_notes TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT,
  payment_method TEXT NOT NULL DEFAULT 'COD',
  payment_status TEXT NOT NULL DEFAULT 'unpaid_cod' CHECK (
    payment_status IN ('unpaid_cod', 'cash_collected', 'settled')
  ),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_number_idx ON orders(order_number);
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_idx ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_shop_idx ON orders(shop_id);
CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders(driver_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name_fr_snapshot TEXT NOT NULL,
  product_name_ar_snapshot TEXT NOT NULL,
  unit_price_mad_snapshot INTEGER NOT NULL CHECK (unit_price_mad_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_mad INTEGER NOT NULL CHECK (line_total_mad >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS driver_assignments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES profiles(id),
  assigned_by_admin_id INTEGER REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  on_the_way_at TIMESTAMP,
  delivered_at TIMESTAMP,
  notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS driver_assignments_order_idx ON driver_assignments(order_id);
CREATE INDEX IF NOT EXISTS driver_assignments_driver_idx ON driver_assignments(driver_id);

CREATE TABLE IF NOT EXISTS cod_records (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES profiles(id),
  expected_amount_mad INTEGER NOT NULL CHECK (expected_amount_mad >= 0),
  collected_amount_mad INTEGER NOT NULL DEFAULT 0 CHECK (collected_amount_mad >= 0),
  driver_earning_mad INTEGER NOT NULL DEFAULT 12,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'remitted_to_admin')),
  collected_at TIMESTAMP,
  remitted_at TIMESTAMP,
  notes TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS cod_records_order_idx ON cod_records(order_id);
CREATE INDEX IF NOT EXISTS cod_records_driver_idx ON cod_records(driver_id);
CREATE INDEX IF NOT EXISTS cod_records_status_idx ON cod_records(status);

CREATE TABLE IF NOT EXISTS loyalty_records (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stamps_count INTEGER NOT NULL DEFAULT 0 CHECK (stamps_count >= 0),
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  total_orders_completed INTEGER NOT NULL DEFAULT 0,
  rewards_redeemed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_customer_idx ON loyalty_records(customer_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE / POSTGRESQL
-- Uses session setting `app.current_user_id` & `app.current_user_role`
-- while allowing direct server pool access when session context is not set.
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cod_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_records ENABLE ROW LEVEL SECURITY;

-- Public read policies for active service zones, approved shops, products, and active promos
DROP POLICY IF EXISTS public_read_zones ON service_zones;
CREATE POLICY public_read_zones ON service_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_shops ON shops;
CREATE POLICY public_read_shops ON shops FOR SELECT USING (
  is_approved = true
  OR current_setting('app.current_user_role', true) IN ('admin', 'partner')
  OR current_setting('app.current_user_role', true) IS NULL
);

DROP POLICY IF EXISTS public_read_products ON products;
CREATE POLICY public_read_products ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS public_read_promotions ON promotions;
CREATE POLICY public_read_promotions ON promotions FOR SELECT USING (true);

-- Scoped access policies for orders (Customer owns, Driver assigned, Partner shop owner, or Admin)
DROP POLICY IF EXISTS role_scoped_orders_policy ON orders;
CREATE POLICY role_scoped_orders_policy ON orders FOR ALL USING (
  current_setting('app.current_user_role', true) IS NULL
  OR current_setting('app.current_user_role', true) = 'admin'
  OR customer_id::text = current_setting('app.current_user_id', true)
  OR driver_id::text = current_setting('app.current_user_id', true)
  OR shop_id IN (
    SELECT id FROM shops WHERE owner_id::text = current_setting('app.current_user_id', true)
  )
);
