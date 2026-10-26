import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  profiles,
  shops,
  products,
  orders,
  serviceZones,
  promotions,
  codRecords,
  driverAssignments,
  loyaltyRecords,
} from "@/db/schema";
import { eq, asc, desc, and, inArray } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";
import { calculateCodAccounting, validateOrderStatusTransition } from "@/lib/business-logic";
import { isUniqueViolation } from "@/lib/db-errors";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Accès strictement réservé à l'administrateur Souk Express Agadir.",
        },
        { status: 403 }
      );
    }

    const allProfiles = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        phone: profiles.phone,
        fullName: profiles.fullName,
        role: profiles.role,
        driverCode: profiles.driverCode,
        vehiclePlate: profiles.vehiclePlate,
        isOnline: profiles.isOnline,
        currentZone: profiles.currentZone,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(asc(profiles.id));

    const allShops = await db.select().from(shops).orderBy(asc(shops.id));
    const allProducts = await db
      .select()
      .from(products)
      .orderBy(asc(products.id));
    const allZones = await db
      .select()
      .from(serviceZones)
      .orderBy(asc(serviceZones.id));
    const allPromos = await db
      .select()
      .from(promotions)
      .orderBy(desc(promotions.id));
    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
    const allCod = await db
      .select()
      .from(codRecords)
      .orderBy(desc(codRecords.id));
    const allLoyalty = await db.select().from(loyaltyRecords);

    // Build Fleet of 4 Motorcycle Drivers summary
    const drivers = allProfiles
      .filter((p) => p.role === "driver")
      .map((drv) => {
        const drvOrders = allOrders.filter((o) => o.driverId === drv.id);
        const activeOrders = drvOrders.filter((o) =>
          ["assigned", "picked_up", "on_the_way"].includes(o.status)
        );
        const drvCod = allCod.filter((c) => c.driverId === drv.id);
        const codStats = calculateCodAccounting(drvCod);
        return {
          ...drv,
          activeOrdersCount: activeOrders.length,
          totalAssignedCount: drvOrders.length,
          codStats,
        };
      });

    // Enrich shops with revenue & payout ledger
    const shopsWithFinancials = allShops.map((sh) => {
      const shOrders = allOrders.filter(
        (o) => o.shopId === sh.id && o.status === "delivered"
      );
      const grossSalesMad = shOrders.reduce((s, o) => s + o.subtotalMad, 0);
      const commissionMad = shOrders.reduce((s, o) => s + o.commissionMad, 0);
      const netPayoutMad = shOrders.reduce((s, o) => s + o.partnerPayoutMad, 0);
      return {
        ...sh,
        deliveredCount: shOrders.length,
        grossSalesMad,
        commissionMad,
        netPayoutMad,
      };
    });

    // Customers with loyalty
    const customers = allProfiles
      .filter((p) => p.role === "customer")
      .map((c) => {
        const loy = allLoyalty.find((l) => l.customerId === c.id);
        const custOrders = allOrders.filter((o) => o.customerId === c.id);
        return {
          ...c,
          ordersCount: custOrders.length,
          stampsCount: loy?.stampsCount ?? 0,
          pointsBalance: loy?.pointsBalance ?? 0,
          rewardsRedeemed: loy?.rewardsRedeemed ?? 0,
        };
      });

    // Financial summaries (Daily & Monthly)
    const deliveredOrders = allOrders.filter((o) => o.status === "delivered");
    const totalGmvMad = deliveredOrders.reduce((s, o) => s + o.totalMad, 0);
    const totalSubtotalsMad = deliveredOrders.reduce(
      (s, o) => s + o.subtotalMad,
      0
    );
    const totalDeliveryFeesMad = deliveredOrders.reduce(
      (s, o) => s + o.deliveryFeeMad,
      0
    );
    const totalCommissionMad = deliveredOrders.reduce(
      (s, o) => s + o.commissionMad,
      0
    );
    const totalPartnerPayoutsMad = deliveredOrders.reduce(
      (s, o) => s + o.partnerPayoutMad,
      0
    );
    const globalCodSummary = calculateCodAccounting(allCod);

    return NextResponse.json({
      drivers,
      shops: shopsWithFinancials,
      products: allProducts,
      zones: allZones,
      promotions: allPromos,
      customers,
      codRecords: allCod,
      summary: {
        totalOrdersCount: allOrders.length,
        deliveredOrdersCount: deliveredOrders.length,
        pendingOrdersCount: allOrders.filter((o) =>
          ["pending", "accepted", "preparing"].includes(o.status)
        ).length,
        activeDeliveryCount: allOrders.filter((o) =>
          ["assigned", "picked_up", "on_the_way"].includes(o.status)
        ).length,
        totalGmvMad,
        totalSubtotalsMad,
        totalDeliveryFeesMad,
        totalCommissionMad,
        totalPartnerPayoutsMad,
        cod: globalCodSummary,
      },
    });
  } catch (error) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du tableau de bord Admin." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Accès réservé à l'administrateur." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // 1. Manually assign an order to one of the 4 motorcycle drivers
    if (action === "assign_driver") {
      const orderId = Number(body.orderId);
      const driverId = Number(body.driverId);
      if (!Number.isInteger(orderId) || !Number.isInteger(driverId)) {
        return NextResponse.json({ error: "Commande ou livreur invalide." }, { status: 400 });
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      const [driver] = await db
        .select()
        .from(profiles)
        .where(
          and(
            eq(profiles.id, driverId),
            eq(profiles.role, "driver"),
            eq(profiles.isActive, true)
          )
        )
        .limit(1);

      if (!order || !driver) {
        return NextResponse.json(
          { error: "Commande ou livreur moto actif introuvable." },
          { status: 404 }
        );
      }

      // Re-assigning an already "assigned" order is allowed; any other move to
      // "assigned" must follow the order state machine (so a delivered,
      // cancelled, rejected or in-transit order can never be silently reset).
      if (order.status !== "assigned") {
        const check = validateOrderStatusTransition(order.status, "assigned", "admin");
        if (!check.valid) {
          return NextResponse.json({ error: check.error }, { status: 409 });
        }
      }

      const now = new Date();
      const updatedOrder = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(orders)
          .set({ driverId: driver.id, status: "assigned", updatedAt: now })
          .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
          .returning();
        if (!updated) return null;

        const [existingAssign] = await tx
          .select()
          .from(driverAssignments)
          .where(eq(driverAssignments.orderId, order.id))
          .limit(1);

        if (existingAssign) {
          await tx
            .update(driverAssignments)
            .set({
              driverId: driver.id,
              assignedByAdminId: user.id,
              status: "assigned",
              assignedAt: now,
            })
            .where(eq(driverAssignments.id, existingAssign.id));
        } else {
          await tx.insert(driverAssignments).values({
            orderId: order.id,
            driverId: driver.id,
            assignedByAdminId: user.id,
            status: "assigned",
          });
        }

        const [existingCod] = await tx
          .select()
          .from(codRecords)
          .where(eq(codRecords.orderId, order.id))
          .limit(1);

        if (existingCod) {
          await tx
            .update(codRecords)
            .set({
              driverId: driver.id,
              expectedAmountMad: order.totalMad,
              driverEarningMad: order.driverEarningMad,
            })
            .where(eq(codRecords.id, existingCod.id));
        } else {
          await tx.insert(codRecords).values({
            orderId: order.id,
            driverId: driver.id,
            expectedAmountMad: order.totalMad,
            collectedAmountMad: 0,
            driverEarningMad: order.driverEarningMad,
            status: "pending",
          });
        }
        return updated;
      });

      if (!updatedOrder) {
        return NextResponse.json(
          { error: "La commande vient d'être modifiée. Actualisez puis réessayez." },
          { status: 409 }
        );
      }

      return NextResponse.json({ ok: true, order: updatedOrder });
    }

    // 2. Approve / Suspend Partner Shop & Set Commission Rate
    if (action === "update_shop") {
      const shopId = Number(body.shopId);
      if (!Number.isInteger(shopId)) {
        return NextResponse.json({ error: "Commerce invalide." }, { status: 400 });
      }
      const updateFields: Partial<typeof shops.$inferInsert> = {};

      if (typeof body.isApproved === "boolean") {
        updateFields.isApproved = body.isApproved;
      }
      if (body.commissionRate !== undefined) {
        const rate = Math.round(Number(body.commissionRate));
        if (!Number.isFinite(rate)) {
          return NextResponse.json({ error: "Commission invalide." }, { status: 400 });
        }
        updateFields.commissionRate = Math.min(100, Math.max(0, rate));
      }
      if (Object.keys(updateFields).length === 0) {
        return NextResponse.json({ error: "Aucune modification à appliquer." }, { status: 400 });
      }

      const [updatedShop] = await db
        .update(shops)
        .set(updateFields)
        .where(eq(shops.id, shopId))
        .returning();

      return NextResponse.json({ ok: true, shop: updatedShop });
    }

    // 3. Reconcile / Settle COD Cash collected by a driver
    if (action === "settle_driver_cod") {
      const driverId = Number(body.driverId);
      if (!Number.isInteger(driverId)) {
        return NextResponse.json({ error: "Livreur invalide." }, { status: 400 });
      }

      const now = new Date();
      const settledCount = await db.transaction(async (tx) => {
        const collectedRecords = await tx
          .select()
          .from(codRecords)
          .where(and(eq(codRecords.driverId, driverId), eq(codRecords.status, "collected")));
        if (collectedRecords.length === 0) return 0;

        await tx
          .update(codRecords)
          .set({
            status: "remitted_to_admin",
            remittedAt: now,
            notes: "Cash remis à l'administration Souk Express",
          })
          .where(inArray(codRecords.id, collectedRecords.map((r) => r.id)));

        await tx
          .update(orders)
          .set({ paymentStatus: "settled", updatedAt: now })
          .where(inArray(orders.id, collectedRecords.map((r) => r.orderId)));

        return collectedRecords.length;
      });

      return NextResponse.json({ ok: true, settledCount });
    }

    // 4. Update or Add Service Zone in Agadir
    if (action === "update_zone") {
      const zoneId = Number(body.zoneId);
      const deliveryFeeMad = Math.max(0, Math.round(Number(body.deliveryFeeMad)));
      const driverPayoutMad = Math.max(
        0,
        Math.round(Number(body.driverPayoutMad))
      );
      if (!Number.isInteger(zoneId) || !Number.isFinite(deliveryFeeMad) || !Number.isFinite(driverPayoutMad)) {
        return NextResponse.json({ error: "Valeurs du quartier invalides." }, { status: 400 });
      }

      const [updatedZone] = await db
        .update(serviceZones)
        .set({
          deliveryFeeMad,
          driverPayoutMad,
          isActive:
            typeof body.isActive === "boolean" ? body.isActive : undefined,
        })
        .where(eq(serviceZones.id, zoneId))
        .returning();

      return NextResponse.json({ ok: true, zone: updatedZone });
    }

    if (action === "create_zone") {
      const nameFr = String(body.nameFr || "").trim();
      const nameAr = String(body.nameAr || nameFr).trim();
      const deliveryFeeMad = Math.max(0, Math.round(Number(body.deliveryFeeMad || 15)));
      const driverPayoutMad = Math.max(
        0,
        Math.round(Number(body.driverPayoutMad || 12))
      );
      if (!nameFr) {
        return NextResponse.json(
          { error: "Nom du quartier requis." },
          { status: 400 }
        );
      }
      const slug = nameFr
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [createdZone] = await db
        .insert(serviceZones)
        .values({
          nameFr,
          nameAr,
          slug: `${slug}-${Date.now().toString().slice(-3)}`,
          deliveryFeeMad,
          driverPayoutMad,
          estimatedMins: String(body.estimatedMins || "25-35 min"),
          mapQuery: `${nameFr}, Agadir, Morocco`,
          isActive: true,
        })
        .returning();

      return NextResponse.json({ ok: true, zone: createdZone });
    }

    // 5. Manage Promotions
    if (action === "create_promo") {
      const code = String(body.code || "")
        .trim()
        .toUpperCase();
      const titleFr = String(body.titleFr || "").trim();
      const titleAr = String(body.titleAr || titleFr).trim();
      const discountMad = Math.max(1, Math.round(Number(body.discountMad)));
      const minOrderMad = Math.max(0, Math.round(Number(body.minOrderMad || 50)));

      if (!code || !titleFr) {
        return NextResponse.json(
          { error: "Code promo et description requis." },
          { status: 400 }
        );
      }
      if (!Number.isFinite(discountMad) || !Number.isFinite(minOrderMad)) {
        return NextResponse.json({ error: "Montants du code promo invalides." }, { status: 400 });
      }

      try {
        const [createdPromo] = await db
          .insert(promotions)
          .values({
            code,
            titleFr,
            titleAr,
            discountMad,
            minOrderMad,
            isActive: true,
          })
          .returning();
        return NextResponse.json({ ok: true, promotion: createdPromo });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return NextResponse.json({ error: "Ce code promo existe déjà." }, { status: 409 });
        }
        throw error;
      }
    }

    if (action === "toggle_promo") {
      const promoId = Number(body.promoId);
      const [updatedPromo] = await db
        .update(promotions)
        .set({ isActive: Boolean(body.isActive) })
        .where(eq(promotions.id, promoId))
        .returning();
      return NextResponse.json({ ok: true, promotion: updatedPromo });
    }

    // 6. Grant / Adjust Loyalty Stamp for Customer (10-stamp card)
    if (action === "grant_stamp") {
      const customerId = Number(body.customerId);
      const delta = Math.trunc(Number(body.delta || 1));
      if (!Number.isInteger(customerId) || !Number.isFinite(delta) || Math.abs(delta) > 20) {
        return NextResponse.json({ error: "Valeurs de tampon invalides." }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(loyaltyRecords)
        .where(eq(loyaltyRecords.customerId, customerId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(loyaltyRecords)
          .set({
            stampsCount: Math.max(0, existing.stampsCount + delta),
            pointsBalance: Math.max(0, existing.pointsBalance + delta * 20),
            updatedAt: new Date(),
          })
          .where(eq(loyaltyRecords.id, existing.id))
          .returning();
        return NextResponse.json({ ok: true, loyalty: updated });
      } else {
        const [created] = await db
          .insert(loyaltyRecords)
          .values({
            customerId,
            stampsCount: Math.max(0, delta),
            pointsBalance: Math.max(0, delta * 20),
            totalOrdersCompleted: 0,
            rewardsRedeemed: 0,
          })
          .returning();
        return NextResponse.json({ ok: true, loyalty: created });
      }
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/admin error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'opération administrateur." },
      { status: 500 }
    );
  }
}
