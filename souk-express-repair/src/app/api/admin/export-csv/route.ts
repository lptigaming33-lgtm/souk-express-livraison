import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, profiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

function escapeCsvCell(value: unknown): string {
  let str = String(value ?? "");
  // CSV/formula injection: Excel & Sheets execute cells that start with = + - @ (or tab / CR).
  // Customer names, addresses and notes are user-controlled, so neutralise them.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Export CSV réservé à l'administrateur." },
        { status: 403 }
      );
    }

    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
    const allItems = await db.select().from(orderItems);
    const drivers = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, "driver"));
    const driverMap = new Map(drivers.map((d) => [d.id, d.fullName]));

    const headers = [
      "N_Commande",
      "Date_Creation",
      "Statut",
      "Client",
      "Telephone_Client",
      "Quartier_Agadir",
      "Adresse_Livraison",
      "Commerce_Partenaire",
      "Livreur_Moto",
      "Articles_Snapshots",
      "Sous_Total_MAD",
      "Frais_Livraison_MAD",
      "Reduction_MAD",
      "Total_Client_MAD",
      "Commission_SoukExpress_MAD",
      "Reversement_Partenaire_MAD",
      "Gain_Livreur_MAD",
      "Statut_Paiement_COD",
    ];

    const rows = allOrders.map((ord) => {
      const itemsText = allItems
        .filter((i) => i.orderId === ord.id)
        .map(
          (i) =>
            `${i.quantity}x ${i.productNameFrSnapshot} (${i.unitPriceMadSnapshot} MAD)`
        )
        .join(" | ");

      const driverName = ord.driverId
        ? driverMap.get(ord.driverId) || `Livreur #${ord.driverId}`
        : "Non assigné";

      return [
        ord.orderNumber,
        ord.createdAt.toISOString(),
        ord.status,
        ord.customerNameSnapshot,
        ord.customerPhoneSnapshot,
        ord.deliveryZoneSnapshot,
        ord.deliveryAddressSnapshot,
        ord.shopNameSnapshot,
        driverName,
        itemsText,
        ord.subtotalMad,
        ord.deliveryFeeMad,
        ord.discountMad,
        ord.totalMad,
        ord.commissionMad,
        ord.partnerPayoutMad,
        ord.driverEarningMad,
        ord.paymentStatus,
      ]
        .map(escapeCsvCell)
        .join(",");
    });

    // UTF-8 BOM for proper French/Arabic rendering in Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="souk-express-agadir-orders.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/export-csv error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du CSV." },
      { status: 500 }
    );
  }
}
