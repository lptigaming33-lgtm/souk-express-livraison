import crypto from "crypto";
import type { OrderStatus, UserRole, CodStatus } from "@/db/schema";

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
  }
  return "development-only-secret-not-for-production";
}

export interface PricedCartItemInput {
  productId: number;
  productNameFr: string;
  productNameAr: string;
  authoritativeUnitPriceMad: number;
  quantity: number;
  isAvailable: boolean;
}

export interface OrderFinancialsInput {
  items: PricedCartItemInput[];
  zoneDeliveryFeeMad: number;
  zoneDriverPayoutMad: number;
  shopCommissionRatePercent: number;
  promoDiscountMad?: number;
  promoMinOrderMad?: number;
  redeemLoyaltyTenStamps?: boolean;
  customerStampsCount?: number;
}

export interface OrderFinancialsResult {
  subtotalMad: number;
  deliveryFeeMad: number;
  discountMad: number;
  totalMad: number;
  commissionMad: number;
  partnerPayoutMad: number;
  driverEarningMad: number;
  loyaltyRewardApplied: boolean;
  lineItems: Array<{
    productId: number;
    productNameFrSnapshot: string;
    productNameArSnapshot: string;
    unitPriceMadSnapshot: number;
    quantity: number;
    lineTotalMad: number;
  }>;
}

/**
 * Pure server-side order pricing engine.
 * Never trusts prices sent from the client browser.
 */
export function calculateOrderFinancials(
  input: OrderFinancialsInput
): OrderFinancialsResult {
  if (!input.items || input.items.length === 0) {
    throw new Error("Order must contain at least one item.");
  }

  let subtotalMad = 0;
  const lineItems = input.items.map((item) => {
    if (!item.isAvailable) {
      throw new Error(`Product "${item.productNameFr}" is currently out of stock.`);
    }
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 99) {
      throw new Error(`Invalid quantity for "${item.productNameFr}".`);
    }
    const unitPrice = Math.round(Number(item.authoritativeUnitPriceMad));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Invalid server price for "${item.productNameFr}".`);
    }
    const lineTotalMad = unitPrice * qty;
    subtotalMad += lineTotalMad;
    return {
      productId: item.productId,
      productNameFrSnapshot: item.productNameFr,
      productNameArSnapshot: item.productNameAr,
      unitPriceMadSnapshot: unitPrice,
      quantity: qty,
      lineTotalMad,
    };
  });

  const deliveryFeeMad = Math.max(0, Math.round(input.zoneDeliveryFeeMad));
  const driverEarningMad = Math.max(0, Math.round(input.zoneDriverPayoutMad));

  let discountMad = 0;
  let loyaltyRewardApplied = false;

  // Promo discount check
  if (
    input.promoDiscountMad &&
    input.promoDiscountMad > 0 &&
    subtotalMad >= (input.promoMinOrderMad ?? 0)
  ) {
    discountMad += Math.round(input.promoDiscountMad);
  }

  // 10-Stamp Loyalty Card check (grants 25 MAD reward when 10 stamps accumulated)
  if (
    input.redeemLoyaltyTenStamps &&
    (input.customerStampsCount ?? 0) >= 10
  ) {
    discountMad += 25;
    loyaltyRewardApplied = true;
  }

  // Discount cannot exceed subtotal + deliveryFee
  const maxPossibleTotal = subtotalMad + deliveryFeeMad;
  discountMad = Math.min(discountMad, maxPossibleTotal);

  const totalMad = Math.max(0, maxPossibleTotal - discountMad);

  const clampedCommissionRate = Math.min(
    100,
    Math.max(0, Math.round(input.shopCommissionRatePercent))
  );
  const commissionMad = Math.round((subtotalMad * clampedCommissionRate) / 100);
  const partnerPayoutMad = Math.max(0, subtotalMad - commissionMad);

  return {
    subtotalMad,
    deliveryFeeMad,
    discountMad,
    totalMad,
    commissionMad,
    partnerPayoutMad,
    driverEarningMad,
    loyaltyRewardApplied,
    lineItems,
  };
}

/**
 * Valid order state transitions and role enforcement
 */
const ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  Array<{ to: OrderStatus; allowedRoles: UserRole[] }>
> = {
  pending: [
    { to: "accepted", allowedRoles: ["partner", "admin"] },
    { to: "rejected", allowedRoles: ["partner", "admin"] },
    { to: "cancelled", allowedRoles: ["customer", "admin"] },
    { to: "assigned", allowedRoles: ["admin"] },
  ],
  accepted: [
    { to: "preparing", allowedRoles: ["partner", "admin"] },
    { to: "assigned", allowedRoles: ["admin"] },
    { to: "rejected", allowedRoles: ["partner", "admin"] },
    { to: "cancelled", allowedRoles: ["admin"] },
  ],
  preparing: [
    { to: "assigned", allowedRoles: ["admin"] },
    { to: "picked_up", allowedRoles: ["driver", "admin"] },
    { to: "cancelled", allowedRoles: ["admin"] },
  ],
  assigned: [
    { to: "picked_up", allowedRoles: ["driver", "admin"] },
    { to: "on_the_way", allowedRoles: ["driver", "admin"] },
    { to: "cancelled", allowedRoles: ["admin"] },
  ],
  picked_up: [
    { to: "on_the_way", allowedRoles: ["driver", "admin"] },
    { to: "delivered", allowedRoles: ["driver", "admin"] },
  ],
  on_the_way: [
    { to: "delivered", allowedRoles: ["driver", "admin"] },
  ],
  delivered: [],
  rejected: [],
  cancelled: [],
};

export function validateOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorRole: UserRole
): { valid: boolean; error?: string } {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const transitions = ALLOWED_TRANSITIONS[currentStatus] || [];
  const match = transitions.find((t) => t.to === nextStatus);

  if (!match) {
    return {
      valid: false,
      error: `Invalid transition from "${currentStatus}" to "${nextStatus}".`,
    };
  }

  if (!match.allowedRoles.includes(actorRole)) {
    return {
      valid: false,
      error: `Role "${actorRole}" is not authorized to change order status from "${currentStatus}" to "${nextStatus}".`,
    };
  }

  return { valid: true };
}

/**
 * Strict RBAC verification so no user can view another user's private order
 */
export function canUserAccessOrder(
  user: { id: number; role: UserRole },
  order: {
    customerId: number;
    driverId: number | null;
    shopOwnerId?: number;
  }
): boolean {
  if (user.role === "admin") return true;
  if (user.role === "customer") return order.customerId === user.id;
  if (user.role === "driver") return order.driverId === user.id;
  if (user.role === "partner") return order.shopOwnerId === user.id;
  return false;
}

/**
 * COD (Cash on Delivery) reconciliation summary for drivers and admin
 */
export interface CodRecordItem {
  driverId: number;
  expectedAmountMad: number;
  collectedAmountMad: number;
  driverEarningMad: number;
  status: CodStatus;
}

export function calculateCodAccounting(records: CodRecordItem[]) {
  let pendingExpectedMad = 0;
  let cashInHandByDriversMad = 0; // collected by driver, not yet remitted to Souk Express
  let remittedToAdminMad = 0; // settled with Souk Express admin
  let totalDriverEarningsMad = 0;
  let completedDeliveriesCount = 0;

  for (const r of records) {
    if (r.status === "pending") {
      pendingExpectedMad += r.expectedAmountMad;
    } else if (r.status === "collected") {
      cashInHandByDriversMad += r.collectedAmountMad;
      totalDriverEarningsMad += r.driverEarningMad;
      completedDeliveriesCount += 1;
    } else if (r.status === "remitted_to_admin") {
      remittedToAdminMad += r.collectedAmountMad;
      totalDriverEarningsMad += r.driverEarningMad;
      completedDeliveriesCount += 1;
    }
  }

  return {
    pendingExpectedMad,
    cashInHandByDriversMad,
    remittedToAdminMad,
    totalCollectedMad: cashInHandByDriversMad + remittedToAdminMad,
    totalDriverEarningsMad,
    completedDeliveriesCount,
  };
}

/**
 * Password & Session Token helpers (Zero-dependency Node crypto)
 */
export function hashPassword(password: string): string {
  // Salted, deliberately expensive password hashing; AUTH_SECRET is not used
  // as a password salt, and each account gets an independent random salt.
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [algorithm, saltHex, derivedHex] = storedHash.split("$");
    if (algorithm !== "scrypt" || !saltHex || !derivedHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(derivedHex, "hex");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  userId: number;
  email: string;
  role: UserRole;
  fullName: string;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(data)
    .digest("base64url");
  const provided = Buffer.from(sig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf-8")
    ) as SessionPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
