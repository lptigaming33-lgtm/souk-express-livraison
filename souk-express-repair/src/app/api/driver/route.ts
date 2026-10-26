import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, codRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { calculateCodAccounting } from "@/lib/business-logic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "driver" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès réservé aux livreurs Souk Express." },
        { status: 403 }
      );
    }

    const driverCod = await db
      .select()
      .from(codRecords)
      .where(eq(codRecords.driverId, user.id));

    const summary = calculateCodAccounting(driverCod);

    return NextResponse.json({
      driver: user,
      codRecords: driverCod,
      summary,
    });
  } catch (error) {
    console.error("GET /api/driver error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de l'espace livreur." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "driver" && user.role !== "admin")) {
      return NextResponse.json(
        { error: "Accès réservé aux livreurs Souk Express." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const isOnline =
      typeof body.isOnline === "boolean" ? body.isOnline : user.isOnline;
    const currentZone = body.currentZone
      ? String(body.currentZone).trim()
      : user.currentZone;

    const [updated] = await db
      .update(profiles)
      .set({
        isOnline,
        currentZone,
      })
      .where(eq(profiles.id, user.id))
      .returning();

    return NextResponse.json({
      ok: true,
      driver: {
        id: updated!.id,
        fullName: updated!.fullName,
        isOnline: updated!.isOnline,
        currentZone: updated!.currentZone,
        driverCode: updated!.driverCode,
        vehiclePlate: updated!.vehiclePlate,
      },
    });
  } catch (error) {
    console.error("PATCH /api/driver error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du statut livreur." },
      { status: 500 }
    );
  }
}
