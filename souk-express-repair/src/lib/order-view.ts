import type { UserRole, orders } from "@/db/schema";

type OrderRow = typeof orders.$inferSelect;

/**
 * Internal money fields are only visible to the roles that need them:
 * customers never see commission / partner payout / driver earning.
 */
export function projectOrderForRole(order: OrderRow, role: UserRole): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...order };
  if (role === "customer") {
    delete copy.commissionMad;
    delete copy.partnerPayoutMad;
    delete copy.driverEarningMad;
  } else if (role === "partner") {
    delete copy.driverEarningMad;
  } else if (role === "driver") {
    delete copy.commissionMad;
    delete copy.partnerPayoutMad;
  }
  return copy;
}
