import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type UserRole = "customer" | "driver" | "partner" | "admin";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "assigned"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "rejected"
  | "cancelled";

export type CodStatus = "pending" | "collected" | "remitted_to_admin";

// 1. Profiles & Roles
export const profiles = pgTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<UserRole>().notNull().default("customer"),
    driverCode: text("driver_code"), // e.g., "MOTO-01", "MOTO-02", "MOTO-03", "MOTO-04"
    vehiclePlate: text("vehicle_plate"), // e.g., "Agadir 4821-A-33"
    isOnline: boolean("is_online").notNull().default(false),
    currentZone: text("current_zone").default("Talborjt"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("profiles_email_idx").on(table.email),
    index("profiles_role_idx").on(table.role),
  ]
);

// 2. Agadir Service Zones & Delivery Fees
export const serviceZones = pgTable(
  "service_zones",
  {
    id: serial("id").primaryKey(),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    slug: text("slug").notNull(),
    deliveryFeeMad: integer("delivery_fee_mad").notNull().default(15),
    driverPayoutMad: integer("driver_payout_mad").notNull().default(12),
    estimatedMins: text("estimated_mins").notNull().default("25-35 min"),
    mapQuery: text("map_query").notNull().default("Agadir, Morocco"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("service_zones_slug_idx").on(table.slug)]
);

// 3. Partner Shops & Restaurants
export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    category: text("category").notNull(), // "restaurants" | "souk" | "epicerie" | "patisserie" | "pharmacie"
    descriptionFr: text("description_fr").notNull(),
    descriptionAr: text("description_ar").notNull(),
    imageUrl: text("image_url").notNull(),
    address: text("address").notNull(),
    zoneId: integer("zone_id").references(() => serviceZones.id),
    phone: text("phone").notNull(),
    commissionRate: integer("commission_rate").notNull().default(15), // percentage e.g. 15%
    prepTimeMins: text("prep_time_mins").notNull().default("20-30 min"),
    rating: text("rating").notNull().default("4.8"),
    isApproved: boolean("is_approved").notNull().default(false),
    isOpen: boolean("is_open").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("shops_owner_idx").on(table.ownerId),
    index("shops_category_idx").on(table.category),
    index("shops_approved_idx").on(table.isApproved),
  ]
);

// 4. Products
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionFr: text("description_fr").notNull(),
    descriptionAr: text("description_ar").notNull(),
    priceMad: integer("price_mad").notNull(), // Integer MAD (e.g. 45 MAD)
    categoryFr: text("category_fr").notNull(),
    categoryAr: text("category_ar").notNull(),
    imageUrl: text("image_url").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("products_shop_idx").on(table.shopId),
    index("products_available_idx").on(table.isAvailable),
  ]
);

// 5. Customer Saved Addresses
export const addresses = pgTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Maison"),
    zoneId: integer("zone_id")
      .notNull()
      .references(() => serviceZones.id),
    streetAddress: text("street_address").notNull(),
    landmark: text("landmark").notNull().default(""),
    phone: text("phone").notNull(),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("addresses_user_idx").on(table.userId)]
);

// 6. Promotions / Promo Codes
export const promotions = pgTable(
  "promotions",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    titleFr: text("title_fr").notNull(),
    titleAr: text("title_ar").notNull(),
    discountMad: integer("discount_mad").notNull(),
    minOrderMad: integer("min_order_mad").notNull().default(50),
    isActive: boolean("is_active").notNull().default(true),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("promotions_code_idx").on(table.code)]
);

// 7. Orders (Server-calculated totals & Snapshots)
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull(), // e.g. "SE-8041"
    customerId: integer("customer_id")
      .notNull()
      .references(() => profiles.id),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id),
    driverId: integer("driver_id").references(() => profiles.id),
    zoneId: integer("zone_id")
      .notNull()
      .references(() => serviceZones.id),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    subtotalMad: integer("subtotal_mad").notNull(),
    deliveryFeeMad: integer("delivery_fee_mad").notNull(),
    discountMad: integer("discount_mad").notNull().default(0),
    totalMad: integer("total_mad").notNull(),
    commissionMad: integer("commission_mad").notNull().default(0),
    partnerPayoutMad: integer("partner_payout_mad").notNull().default(0),
    driverEarningMad: integer("driver_earning_mad").notNull().default(12),
    promoCode: text("promo_code"),
    loyaltyRewardUsed: boolean("loyalty_reward_used").notNull().default(false),
    deliveryAddressSnapshot: text("delivery_address_snapshot").notNull(),
    deliveryZoneSnapshot: text("delivery_zone_snapshot").notNull(),
    deliveryLandmarkSnapshot: text("delivery_landmark_snapshot")
      .notNull()
      .default(""),
    customerNameSnapshot: text("customer_name_snapshot").notNull(),
    customerPhoneSnapshot: text("customer_phone_snapshot").notNull(),
    shopNameSnapshot: text("shop_name_snapshot").notNull(),
    shopAddressSnapshot: text("shop_address_snapshot").notNull(),
    shopPhoneSnapshot: text("shop_phone_snapshot").notNull(),
    orderNotes: text("order_notes").notNull().default(""),
    rejectionReason: text("rejection_reason"),
    paymentMethod: text("payment_method").notNull().default("COD"), // Cash on Delivery
    paymentStatus: text("payment_status").notNull().default("unpaid_cod"), // "unpaid_cod" | "cash_collected" | "settled"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
  },
  (table) => [
    uniqueIndex("orders_number_idx").on(table.orderNumber),
    uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey),
    index("orders_customer_idx").on(table.customerId),
    index("orders_shop_idx").on(table.shopId),
    index("orders_driver_idx").on(table.driverId),
    index("orders_status_idx").on(table.status),
  ]
);

// 8. Order Items (Immutable product name & price snapshots)
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productNameFrSnapshot: text("product_name_fr_snapshot").notNull(),
    productNameArSnapshot: text("product_name_ar_snapshot").notNull(),
    unitPriceMadSnapshot: integer("unit_price_mad_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalMad: integer("line_total_mad").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)]
);

// 9. Driver Assignments (Audit trail & dispatch timestamps)
export const driverAssignments = pgTable(
  "driver_assignments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => profiles.id),
    assignedByAdminId: integer("assigned_by_admin_id").references(
      () => profiles.id
    ),
    status: text("status").notNull().default("assigned"), // "assigned" | "acknowledged" | "picked_up" | "on_the_way" | "delivered"
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
    pickedUpAt: timestamp("picked_up_at"),
    onTheWayAt: timestamp("on_the_way_at"),
    deliveredAt: timestamp("delivered_at"),
    notes: text("notes").default(""),
  },
  (table) => [
    index("driver_assignments_order_idx").on(table.orderId),
    index("driver_assignments_driver_idx").on(table.driverId),
  ]
);

// 10. Cash on Delivery (COD) Records
export const codRecords = pgTable(
  "cod_records",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => profiles.id),
    expectedAmountMad: integer("expected_amount_mad").notNull(),
    collectedAmountMad: integer("collected_amount_mad").notNull().default(0),
    driverEarningMad: integer("driver_earning_mad").notNull().default(12),
    status: text("status").$type<CodStatus>().notNull().default("pending"),
    collectedAt: timestamp("collected_at"),
    remittedAt: timestamp("remitted_at"),
    notes: text("notes").default(""),
  },
  (table) => [
    uniqueIndex("cod_records_order_idx").on(table.orderId),
    index("cod_records_driver_idx").on(table.driverId),
    index("cod_records_status_idx").on(table.status),
  ]
);

// 11. Loyalty Records & 10-Stamp Card
export const loyaltyRecords = pgTable(
  "loyalty_records",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stampsCount: integer("stamps_count").notNull().default(0), // 0 to 10 (at 10 stamps -> free delivery / 25 MAD reward!)
    pointsBalance: integer("points_balance").notNull().default(0),
    totalOrdersCompleted: integer("total_orders_completed").notNull().default(0),
    rewardsRedeemed: integer("rewards_redeemed").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("loyalty_customer_idx").on(table.customerId)]
);
