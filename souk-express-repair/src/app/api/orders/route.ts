import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  orders,
  orderItems,
  products,
  shops,
  serviceZones,
  promotions,
  loyaltyRecords,
  codRecords,
  driverAssignments,
  profiles,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";
import { calculateOrderFinancials } from "@/lib/business-logic";
import { isUniqueViolation } from "@/lib/db-errors";
import { projectOrderForRole } from "@/lib/order-view";

type OrderRow = typeof orders.$inferSelect;

/** Business-rule failure that is safe to show to the customer (HTTP 400). */
class OrderInputError extends Error {}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise pour consulter les commandes." },
        { status: 401 }
      );
    }

    let scopedOrders: OrderRow[] = [];

    if (user.role === "admin") {
      scopedOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    } else if (user.role === "customer") {
      scopedOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, user.id))
        .orderBy(desc(orders.createdAt));
    } else if (user.role === "driver") {
      // Strictly view ONLY assigned orders
      scopedOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.driverId, user.id))
        .orderBy(desc(orders.createdAt));
    } else if (user.role === "partner") {
      const partnerShops = await db
        .select({ id: shops.id })
        .from(shops)
        .where(eq(shops.ownerId, user.id));
      const shopIds = partnerShops.map((s) => s.id);
      if (shopIds.length > 0) {
        scopedOrders = await db
          .select()
          .from(orders)
          .where(inArray(orders.shopId, shopIds))
          .orderBy(desc(orders.createdAt));
      }
    }

    if (scopedOrders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const orderIds = scopedOrders.map((o) => o.id);
    const allItems = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const allCod =
      user.role === "customer"
        ? []
        : await db.select().from(codRecords).where(inArray(codRecords.orderId, orderIds));

    const allAssignments = await db
      .select()
      .from(driverAssignments)
      .where(inArray(driverAssignments.orderId, orderIds));

    // Only load the drivers that are actually referenced by these orders.
    const driverIds = [
      ...new Set(
        scopedOrders.map((o) => o.driverId).filter((d): d is number => d !== null)
      ),
    ];
    const driversList =
      driverIds.length > 0
        ? await db
            .select({
              id: profiles.id,
              fullName: profiles.fullName,
              phone: profiles.phone,
              driverCode: profiles.driverCode,
              vehiclePlate: profiles.vehiclePlate,
            })
            .from(profiles)
            .where(inArray(profiles.id, driverIds))
        : [];

    const driverMap = new Map(driversList.map((d) => [d.id, d]));

    const enriched = scopedOrders.map((ord) => ({
      ...projectOrderForRole(ord, user.role),
      items: allItems.filter((i) => i.orderId === ord.id),
      codRecord: allCod.find((c) => c.orderId === ord.id) ?? null,
      assignment: allAssignments.find((a) => a.orderId === ord.id) ?? null,
      driverInfo: ord.driverId ? driverMap.get(ord.driverId) ?? null : null,
    }));

    return NextResponse.json({ orders: enriched });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des commandes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Veuillez vous connecter pour passer une commande." },
        { status: 401 }
      );
    }

    if (user.role !== "customer") {
      return NextResponse.json(
        { error: "Seuls les comptes clients peuvent passer commande." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const idempotencyKey = String(body.idempotencyKey || "").trim();
    if (!idempotencyKey || idempotencyKey.length > 100) {
      return NextResponse.json({ error: "Clé d'idempotence manquante ou invalide." }, { status: 400 });
    }

    // A key only ever resolves to the caller's OWN order (never another customer's).
    const findOwnOrderByKey = async () => {
      const [found] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.idempotencyKey, idempotencyKey), eq(orders.customerId, user.id)))
        .limit(1);
      return found ?? null;
    };

    const existingOrder = await findOwnOrderByKey();
    if (existingOrder) {
      return NextResponse.json({
        ok: true,
        duplicatePrevented: true,
        order: projectOrderForRole(existingOrder, "customer"),
      });
    }

    const shopId = Number(body.shopId);
    const zoneId = Number(body.zoneId);
    const deliveryAddress = cleanText(body.deliveryAddress, 300);
    const deliveryLandmark = cleanText(body.deliveryLandmark, 200);
    const customerPhone = cleanText(body.customerPhone || user.phone, 30);
    const orderNotes = cleanText(body.orderNotes, 500);
    const promoCodeInput = cleanText(body.promoCode, 40).toUpperCase();
    const redeemLoyaltyTenStamps = Boolean(body.redeemLoyaltyTenStamps);
    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    if (
      !Number.isInteger(shopId) || shopId <= 0 ||
      !Number.isInteger(zoneId) || zoneId <= 0 ||
      !deliveryAddress ||
      rawItems.length === 0
    ) {
      throw new OrderInputError(
        "Adresse de livraison à Agadir, quartier et articles du panier sont obligatoires."
      );
    }
    if (rawItems.length > 30) {
      throw new OrderInputError("Le panier contient trop d'articles (30 maximum).");
    }
    if (!/^[+0-9()\s.-]{6,30}$/.test(customerPhone)) {
      throw new OrderInputError("Numéro de téléphone invalide.");
    }

    const cartLines = rawItems.map((raw) => {
      const item = (raw ?? {}) as { productId?: unknown; quantity?: unknown };
      return { productId: Number(item.productId), quantity: Number(item.quantity) };
    });
    if (
      cartLines.some(
        (l) =>
          !Number.isInteger(l.productId) || l.productId <= 0 ||
          !Number.isInteger(l.quantity) || l.quantity <= 0 || l.quantity > 99
      )
    ) {
      throw new OrderInputError("Panier invalide : produit ou quantité incorrects.");
    }

    // Authoritative shop & zone
    const [shop] = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);
    if (!shop || !shop.isApproved || !shop.isOpen) {
      throw new OrderInputError("Ce commerce n'est pas disponible actuellement.");
    }

    const [zone] = await db.select().from(serviceZones).where(eq(serviceZones.id, zoneId)).limit(1);
    if (!zone || !zone.isActive) {
      throw new OrderInputError("Quartier de livraison invalide.");
    }

    // Authoritative prices from the database (never trust browser prices)
    const dbProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, cartLines.map((l) => l.productId)));
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    const pricedInputs = cartLines.map((line) => {
      const dbProd = productMap.get(line.productId);
      if (!dbProd || dbProd.shopId !== shop.id) {
        throw new OrderInputError("Un produit du panier n'appartient pas à ce commerce.");
      }
      return {
        productId: dbProd.id,
        productNameFr: dbProd.nameFr,
        productNameAr: dbProd.nameAr,
        authoritativeUnitPriceMad: dbProd.priceMad,
        quantity: line.quantity,
        isAvailable: dbProd.isAvailable,
      };
    });

    // Promo code (explicit error rather than silently charging full price)
    let promoDiscountMad = 0;
    let promoMinOrderMad = 0;
    let matchedPromo: typeof promotions.$inferSelect | null = null;
    if (promoCodeInput) {
      const [foundPromo] = await db
        .select()
        .from(promotions)
        .where(eq(promotions.code, promoCodeInput))
        .limit(1);
      if (!foundPromo || !foundPromo.isActive) {
        throw new OrderInputError("Code promo invalide ou expiré.");
      }
      promoDiscountMad = foundPromo.discountMad;
      promoMinOrderMad = foundPromo.minOrderMad;
      matchedPromo = foundPromo;
    }

    const [customerLoyalty] = await db
      .select()
      .from(loyaltyRecords)
      .where(eq(loyaltyRecords.customerId, user.id))
      .limit(1);

    if (redeemLoyaltyTenStamps && (customerLoyalty?.stampsCount ?? 0) < 10) {
      throw new OrderInputError("Il faut 10 tampons pour utiliser la récompense de fidélité.");
    }

    let financials: ReturnType<typeof calculateOrderFinancials>;
    try {
      financials = calculateOrderFinancials({
        items: pricedInputs,
        zoneDeliveryFeeMad: zone.deliveryFeeMad,
        zoneDriverPayoutMad: zone.driverPayoutMad,
        shopCommissionRatePercent: shop.commissionRate,
        promoDiscountMad,
        promoMinOrderMad,
        redeemLoyaltyTenStamps,
        customerStampsCount: customerLoyalty?.stampsCount ?? 0,
      });
    } catch {
      throw new OrderInputError("Panier invalide ou article en rupture de stock.");
    }

    // The promo only counts as used if its minimum order amount was reached.
    const promoApplied = matchedPromo !== null && financials.subtotalMad >= promoMinOrderMad;

    // Customer-safe view of the totals (no commission / payouts).
    const customerFinancials = {
      subtotalMad: financials.subtotalMad,
      deliveryFeeMad: financials.deliveryFeeMad,
      discountMad: financials.discountMad,
      totalMad: financials.totalMad,
      loyaltyRewardApplied: financials.loyaltyRewardApplied,
      lineItems: financials.lineItems,
    };

    for (let attempt = 1; ; attempt++) {
      try {
        const createdOrder = await db.transaction(async (tx) => {
          // 6-digit random number; the UNIQUE constraint + retry guarantees no duplicates.
          const orderNumber = `SE-${crypto.randomInt(100000, 1000000)}`;

          const [inserted] = await tx
            .insert(orders)
            .values({
              orderNumber,
              customerId: user.id,
              shopId: shop.id,
              driverId: null,
              zoneId: zone.id,
              status: "pending",
              idempotencyKey,
              subtotalMad: financials.subtotalMad,
              deliveryFeeMad: financials.deliveryFeeMad,
              discountMad: financials.discountMad,
              totalMad: financials.totalMad,
              commissionMad: financials.commissionMad,
              partnerPayoutMad: financials.partnerPayoutMad,
              driverEarningMad: financials.driverEarningMad,
              promoCode: promoApplied && matchedPromo ? matchedPromo.code : null,
              loyaltyRewardUsed: financials.loyaltyRewardApplied,
              deliveryAddressSnapshot: deliveryAddress,
              deliveryZoneSnapshot: zone.nameFr,
              deliveryLandmarkSnapshot: deliveryLandmark,
              customerNameSnapshot: user.fullName,
              customerPhoneSnapshot: customerPhone,
              shopNameSnapshot: shop.nameFr,
              shopAddressSnapshot: shop.address,
              shopPhoneSnapshot: shop.phone,
              orderNotes,
              paymentMethod: "COD",
              paymentStatus: "unpaid_cod",
            })
            .returning();

          await tx.insert(orderItems).values(
            financials.lineItems.map((li) => ({
              orderId: inserted!.id,
              productId: li.productId,
              productNameFrSnapshot: li.productNameFrSnapshot,
              productNameArSnapshot: li.productNameArSnapshot,
              unitPriceMadSnapshot: li.unitPriceMadSnapshot,
              quantity: li.quantity,
              lineTotalMad: li.lineTotalMad,
            }))
          );

          if (promoApplied && matchedPromo) {
            await tx
              .update(promotions)
              .set({ usageCount: sql`${promotions.usageCount} + 1` })
              .where(eq(promotions.id, matchedPromo.id));
          }

          if (financials.loyaltyRewardApplied) {
            // Atomic: only succeeds while the customer still has >= 10 stamps.
            const redeemed = await tx
              .update(loyaltyRecords)
              .set({
                stampsCount: sql`${loyaltyRecords.stampsCount} - 10`,
                rewardsRedeemed: sql`${loyaltyRecords.rewardsRedeemed} + 1`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(loyaltyRecords.customerId, user.id),
                  gte(loyaltyRecords.stampsCount, 10)
                )
              )
              .returning({ id: loyaltyRecords.id });
            if (redeemed.length === 0) {
              throw new OrderInputError("Tampons de fidélité insuffisants.");
            }
          }

          return inserted!;
        });

        return NextResponse.json({
          ok: true,
          order: projectOrderForRole(createdOrder, "customer"),
          financials: customerFinancials,
        });
      } catch (error) {
        if (isUniqueViolation(error, "number") && attempt < 5) continue; // order-number collision
        if (isUniqueViolation(error, "idempotency")) {
          const sameKeyOrder = await findOwnOrderByKey();
          if (sameKeyOrder) {
            return NextResponse.json({
              ok: true,
              duplicatePrevented: true,
              order: projectOrderForRole(sameKeyOrder, "customer"),
            });
          }
          return NextResponse.json({ error: "Clé d'idempotence déjà utilisée." }, { status: 409 });
        }
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof OrderInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la commande." },
      { status: 500 }
    );
  }
}
