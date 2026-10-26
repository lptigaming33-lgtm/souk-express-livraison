import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  shops,
  products,
  serviceZones,
  promotions,
  loyaltyRecords,
  addresses,
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getCurrentUser();

    const allZones = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.isActive, true))
      .orderBy(asc(serviceZones.deliveryFeeMad));

    // Only approved shops are shown in the customer marketplace
    const approvedShops = await db
      .select()
      .from(shops)
      .where(eq(shops.isApproved, true))
      .orderBy(asc(shops.id));

    // Never expose products of unapproved / suspended shops
    const approvedShopIds = approvedShops.map((s) => s.id);
    const allProducts =
      approvedShopIds.length > 0
        ? await db
            .select()
            .from(products)
            .where(inArray(products.shopId, approvedShopIds))
            .orderBy(asc(products.id))
        : [];

    const activePromos = await db
      .select()
      .from(promotions)
      .where(eq(promotions.isActive, true));

    let loyalty = null;
    let userAddresses: (typeof addresses.$inferSelect)[] = [];

    if (user) {
      const [foundLoyalty] = await db
        .select()
        .from(loyaltyRecords)
        .where(eq(loyaltyRecords.customerId, user.id))
        .limit(1);

      loyalty = foundLoyalty ?? {
        customerId: user.id,
        stampsCount: 0,
        pointsBalance: 0,
        totalOrdersCompleted: 0,
        rewardsRedeemed: 0,
      };

      userAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.userId, user.id));
    }

    return NextResponse.json({
      zones: allZones,
      shops: approvedShops,
      products: allProducts,
      promotions: activePromos,
      loyalty,
      addresses: userAddresses,
    });
  } catch (error) {
    console.error("GET /api/catalog error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du catalogue d'Agadir." },
      { status: 500 }
    );
  }
}
