import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  shops,
  driverAssignments,
  codRecords,
  loyaltyRecords,
  promotions,
  type OrderStatus,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  canUserAccessOrder,
  validateOrderStatusTransition,
} from "@/lib/business-logic";
import { projectOrderForRole } from "@/lib/order-view";

const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "assigned",
  "picked_up",
  "on_the_way",
  "delivered",
  "rejected",
  "cancelled",
];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { id } = await context.params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID commande invalide." }, { status: 400 });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const [shop] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);

    const hasAccess = canUserAccessOrder(user, {
      customerId: order.customerId,
      driverId: order.driverId,
      shopOwnerId: shop?.ownerId,
    });
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès refusé : vous n'êtes pas autorisé à modifier cette commande." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Driver acknowledging assignment without changing main order status
    if (body.action === "acknowledge") {
      if (user.role !== "driver" && user.role !== "admin") {
        return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
      }
      await db
        .update(driverAssignments)
        .set({ status: "acknowledged", acknowledgedAt: new Date() })
        .where(eq(driverAssignments.orderId, order.id));
      return NextResponse.json({ ok: true });
    }

    const nextStatus = body.status as OrderStatus;
    if (!nextStatus || !ORDER_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: "Nouveau statut valide requis." }, { status: 400 });
    }

    // Re-sending the current status is a harmless no-op: it must NEVER re-run
    // side effects (loyalty stamps, COD record, delivery timestamp, ...).
    if (nextStatus === order.status) {
      return NextResponse.json({ ok: true, order: projectOrderForRole(order, user.role), unchanged: true });
    }

    const check = validateOrderStatusTransition(order.status, nextStatus, user.role);
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    // Validate driver-supplied cash amount BEFORE touching the database.
    let collectedMad = order.totalMad;
    if (nextStatus === "delivered" && body.collectedAmountMad !== undefined && body.collectedAmountMad !== null && body.collectedAmountMad !== "") {
      const parsed = Math.round(Number(body.collectedAmountMad));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) {
        return NextResponse.json({ error: "Montant encaissé invalide." }, { status: 400 });
      }
      collectedMad = parsed;
    }

    const now = new Date();
    const closing = nextStatus === "rejected" || nextStatus === "cancelled";
    const rejectionReason = closing
      ? String(body.rejectionReason ?? "").trim().slice(0, 300) || order.rejectionReason
      : order.rejectionReason;

    const updateData: Partial<typeof orders.$inferInsert> = {
      status: nextStatus,
      updatedAt: now,
      rejectionReason,
    };
    if (nextStatus === "delivered") {
      updateData.deliveredAt = now;
      updateData.paymentStatus = "cash_collected";
    }

    const updatedOrder = await db.transaction(async (tx) => {
      // Compare-and-swap on the current status: if two requests race, only one wins.
      const [updated] = await tx
        .update(orders)
        .set(updateData)
        .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
        .returning();
      if (!updated) return null;

      if (nextStatus === "picked_up") {
        await tx
          .update(driverAssignments)
          .set({ status: "picked_up", pickedUpAt: now })
          .where(eq(driverAssignments.orderId, order.id));
      } else if (nextStatus === "on_the_way") {
        await tx
          .update(driverAssignments)
          .set({ status: "on_the_way", onTheWayAt: now })
          .where(eq(driverAssignments.orderId, order.id));
      } else if (nextStatus === "delivered") {
        await tx
          .update(driverAssignments)
          .set({ status: "delivered", deliveredAt: now })
          .where(eq(driverAssignments.orderId, order.id));

        const baseNote = body.codNotes
          ? String(body.codNotes).trim().slice(0, 200)
          : "Cash encaissé à la livraison";
        const codNote =
          collectedMad !== order.totalMad
            ? `ÉCART : attendu ${order.totalMad} MAD, encaissé ${collectedMad} MAD. ${baseNote}`
            : baseNote;

        const [existingCod] = await tx
          .select()
          .from(codRecords)
          .where(eq(codRecords.orderId, order.id))
          .limit(1);

        if (existingCod) {
          await tx
            .update(codRecords)
            .set({
              collectedAmountMad: collectedMad,
              status: "collected",
              collectedAt: now,
              notes: codNote,
            })
            .where(eq(codRecords.id, existingCod.id));
        } else if (order.driverId) {
          await tx.insert(codRecords).values({
            orderId: order.id,
            driverId: order.driverId,
            expectedAmountMad: order.totalMad,
            collectedAmountMad: collectedMad,
            driverEarningMad: order.driverEarningMad,
            status: "collected",
            collectedAt: now,
            notes: codNote,
          });
        }

        // +1 stamp & +20 points, atomically (a single delivered transition happens once).
        await tx
          .insert(loyaltyRecords)
          .values({
            customerId: order.customerId,
            stampsCount: 1,
            pointsBalance: 20,
            totalOrdersCompleted: 1,
            rewardsRedeemed: 0,
          })
          .onConflictDoUpdate({
            target: loyaltyRecords.customerId,
            set: {
              stampsCount: sql`${loyaltyRecords.stampsCount} + 1`,
              pointsBalance: sql`${loyaltyRecords.pointsBalance} + 20`,
              totalOrdersCompleted: sql`${loyaltyRecords.totalOrdersCompleted} + 1`,
              updatedAt: now,
            },
          });
      } else if (closing) {
        // Order will never be fulfilled: give back what was consumed at checkout.
        if (order.loyaltyRewardUsed) {
          await tx
            .update(loyaltyRecords)
            .set({
              stampsCount: sql`${loyaltyRecords.stampsCount} + 10`,
              rewardsRedeemed: sql`GREATEST(${loyaltyRecords.rewardsRedeemed} - 1, 0)`,
              updatedAt: now,
            })
            .where(eq(loyaltyRecords.customerId, order.customerId));
        }
        if (order.promoCode) {
          await tx
            .update(promotions)
            .set({ usageCount: sql`GREATEST(${promotions.usageCount} - 1, 0)` })
            .where(eq(promotions.code, order.promoCode));
        }
      }

      return updated;
    });

    if (!updatedOrder) {
      return NextResponse.json(
        { error: "La commande vient d'être modifiée. Actualisez puis réessayez." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, order: projectOrderForRole(updatedOrder, user.role) });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour du statut." },
      { status: 500 }
    );
  }
}
