import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shops, products, orders } from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "partner" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès réservé aux commerçants partenaires." },
        { status: 403 }
      );
    }

    const partnerShops =
      user.role === "admin"
        ? await db.select().from(shops).orderBy(asc(shops.id))
        : await db
            .select()
            .from(shops)
            .where(eq(shops.ownerId, user.id))
            .orderBy(asc(shops.id));

    const shopIds = partnerShops.map((s) => s.id);
    const shopProducts =
      shopIds.length > 0
        ? await db
            .select()
            .from(products)
            .where(inArray(products.shopId, shopIds))
            .orderBy(asc(products.id))
        : [];

    const shopOrders =
      shopIds.length > 0
        ? await db
            .select()
            .from(orders)
            .where(inArray(orders.shopId, shopIds))
        : [];

    const deliveredOrders = shopOrders.filter((o) => o.status === "delivered");
    const grossSalesMad = deliveredOrders.reduce(
      (acc, o) => acc + o.subtotalMad,
      0
    );
    const totalCommissionMad = deliveredOrders.reduce(
      (acc, o) => acc + o.commissionMad,
      0
    );
    const netPayoutMad = deliveredOrders.reduce(
      (acc, o) => acc + o.partnerPayoutMad,
      0
    );

    return NextResponse.json({
      shops: partnerShops,
      products: shopProducts,
      stats: {
        totalOrders: shopOrders.length,
        deliveredOrders: deliveredOrders.length,
        grossSalesMad,
        totalCommissionMad,
        netPayoutMad,
      },
    });
  } catch (error) {
    console.error("GET /api/partner error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du portail partenaire." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "partner" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès réservé aux partenaires." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const shopId = Number(body.shopId);

    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    if (!shop || (user.role !== "admin" && shop.ownerId !== user.id)) {
      return NextResponse.json(
        { error: "Vous n'êtes pas propriétaire de ce commerce." },
        { status: 403 }
      );
    }

    const nameFr = String(body.nameFr || "").trim();
    const nameAr = String(body.nameAr || nameFr).trim();
    const descriptionFr = String(
      body.descriptionFr || "Préparé frais à Agadir."
    ).trim();
    const descriptionAr = String(body.descriptionAr || descriptionFr).trim();
    const priceMad = Math.round(Number(body.priceMad));
    const categoryFr = String(body.categoryFr || "Spécialités").trim();
    const categoryAr = String(body.categoryAr || "تخصصات").trim();
    const imageUrl =
      String(body.imageUrl || "").trim() ||
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80";

    if (!nameFr || !Number.isFinite(priceMad) || priceMad <= 0) {
      return NextResponse.json(
        { error: "Nom du produit et prix valide en MAD requis." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(products)
      .values({
        shopId: shop.id,
        nameFr,
        nameAr,
        descriptionFr,
        descriptionAr,
        priceMad,
        categoryFr,
        categoryAr,
        imageUrl,
        isAvailable: true,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      product: created,
    });
  } catch (error) {
    console.error("POST /api/partner error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout du produit." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "partner" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès réservé aux partenaires." },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (body.action === "toggle_shop_open") {
      const shopId = Number(body.shopId);
      const [shop] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (!shop || (user.role !== "admin" && shop.ownerId !== user.id)) {
        return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
      }

      const [updatedShop] = await db
        .update(shops)
        .set({ isOpen: Boolean(body.isOpen) })
        .where(eq(shops.id, shopId))
        .returning();

      return NextResponse.json({ ok: true, shop: updatedShop });
    }

    // Update product availability or price
    const productId = Number(body.productId);
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!prod) {
      return NextResponse.json(
        { error: "Produit introuvable." },
        { status: 404 }
      );
    }

    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, prod.shopId))
      .limit(1);

    if (!shop || (user.role !== "admin" && shop.ownerId !== user.id)) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    }

    const newPrice =
      body.priceMad !== undefined
        ? Math.max(1, Math.round(Number(body.priceMad)))
        : prod.priceMad;
    const newAvail =
      typeof body.isAvailable === "boolean"
        ? body.isAvailable
        : prod.isAvailable;

    const [updatedProd] = await db
      .update(products)
      .set({
        priceMad: newPrice,
        isAvailable: newAvail,
      })
      .where(eq(products.id, prod.id))
      .returning();

    return NextResponse.json({
      ok: true,
      product: updatedProd,
    });
  } catch (error) {
    console.error("PATCH /api/partner error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la modification du produit." },
      { status: 500 }
    );
  }
}
