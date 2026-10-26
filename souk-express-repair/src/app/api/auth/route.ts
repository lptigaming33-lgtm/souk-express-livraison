import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, shops, loyaltyRecords, serviceZones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";
import {
  getCurrentUser,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/business-logic";

// Used to burn the same scrypt time when the email is unknown (prevents account enumeration by timing).
let dummyHash: string | undefined;
function getDummyHash(): string {
  const hash: string = dummyHash ?? hashPassword("timing-equalisation-password");
  dummyHash = hash;
  return hash;
}

export async function GET() {
  try {
    await ensureSeeded();
    let user = await getCurrentUser();

    // Demo account switching is strictly development-only and explicitly opt-in.
    // Never disclose account emails or phone numbers through a public endpoint.
    const demoMode =
      process.env.NODE_ENV !== "production" &&
      process.env.SEED_DEMO_DATA === "true";
    let demoAccounts: Array<{
      id: number; email: string; fullName: string; role: string;
      driverCode: string | null; vehiclePlate: string | null;
      isOnline: boolean; currentZone: string | null; phone: string;
    }> = [];
    if (demoMode) {
      demoAccounts = await db
        .select({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
          role: profiles.role,
          driverCode: profiles.driverCode,
          vehiclePlate: profiles.vehiclePlate,
          isOnline: profiles.isOnline,
          currentZone: profiles.currentZone,
          phone: profiles.phone,
        })
        .from(profiles);
    }

    return NextResponse.json({ user, demoAccounts });
  } catch (error) {
    console.error("GET /api/auth error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la vérification de session." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      await clearSessionCookie();
      return NextResponse.json({ ok: true, user: null });
    }

    if (action === "switch_demo_user") {
      if (process.env.NODE_ENV === "production" || process.env.SEED_DEMO_DATA !== "true") {
        return NextResponse.json({ error: "Fonction de démonstration désactivée." }, { status: 403 });
      }
      const targetId = Number(body.userId);
      const [found] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, targetId))
        .limit(1);

      if (!found) {
        return NextResponse.json(
          { error: "Compte introuvable." },
          { status: 404 }
        );
      }

      await setSessionCookie({
        id: found.id,
        email: found.email,
        role: found.role,
        fullName: found.fullName,
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: found.id,
          email: found.email,
          phone: found.phone,
          fullName: found.fullName,
          role: found.role,
          driverCode: found.driverCode,
          vehiclePlate: found.vehiclePlate,
          isOnline: found.isOnline,
          currentZone: found.currentZone,
        },
      });
    }

    if (action === "login") {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json(
          { error: "Veuillez saisir votre email et mot de passe." },
          { status: 400 }
        );
      }

      const [found] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1);

      const passwordOk = verifyPassword(password, found ? found.passwordHash : getDummyHash());
      if (!found || !found.isActive || !passwordOk) {
        return NextResponse.json(
          { error: "Email ou mot de passe incorrect." },
          { status: 401 }
        );
      }

      await setSessionCookie({
        id: found.id,
        email: found.email,
        role: found.role,
        fullName: found.fullName,
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: found.id,
          email: found.email,
          phone: found.phone,
          fullName: found.fullName,
          role: found.role,
          driverCode: found.driverCode,
          vehiclePlate: found.vehiclePlate,
          isOnline: found.isOnline,
          currentZone: found.currentZone,
        },
      });
    }

    if (action === "signup") {
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.fullName || "").trim().slice(0, 100);
      const phone = String(body.phone || "+212600000000").trim();
      const requestedRole =
        body.role === "partner" ? "partner" : "customer";

      if (!email || !password || !fullName) {
        return NextResponse.json(
          { error: "Tous les champs obligatoires doivent être remplis." },
          { status: 400 }
        );
      }

      if (password.length < 12 || password.length > 200) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir entre 12 et 200 caractères." },
          { status: 400 }
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
        return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1);

      if (existing) {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé à Agadir." },
          { status: 409 }
        );
      }

      const [created] = await db
        .insert(profiles)
        .values({
          email,
          phone,
          fullName,
          passwordHash: hashPassword(password),
          role: requestedRole,
          currentZone: "Talborjt",
          isOnline: true,
        })
        .returning();

      if (requestedRole === "customer") {
        await db.insert(loyaltyRecords).values({
          customerId: created!.id,
          stampsCount: 1, // Welcome stamp!
          pointsBalance: 20,
          totalOrdersCompleted: 0,
          rewardsRedeemed: 0,
        });
      } else if (requestedRole === "partner") {
        const shopName = String(
          body.shopName || `Commerce de ${fullName}`
        ).trim();
        const shopCategory = String(body.shopCategory || "restaurants");
        const shopAddress = String(
          body.shopAddress || "Agadir Centre, Maroc"
        ).trim();
        const [firstZone] = await db.select().from(serviceZones).limit(1);

        await db.insert(shops).values({
          ownerId: created!.id,
          nameFr: shopName,
          nameAr: shopName,
          category: shopCategory,
          descriptionFr: "Nouveau commerce partenaire à Agadir.",
          descriptionAr: "متجر شريك جديد في أكادير.",
          imageUrl:
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
          address: shopAddress,
          zoneId: firstZone?.id ?? null,
          phone,
          commissionRate: 15,
          prepTimeMins: "25-35 min",
          rating: "4.8",
          isApproved: false, // Must be approved by administrator!
          isOpen: true,
        });
      }

      await setSessionCookie({
        id: created!.id,
        email: created!.email,
        role: created!.role,
        fullName: created!.fullName,
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: created!.id,
          email: created!.email,
          phone: created!.phone,
          fullName: created!.fullName,
          role: created!.role,
          driverCode: created!.driverCode,
          vehiclePlate: created!.vehiclePlate,
          isOnline: created!.isOnline,
          currentZone: created!.currentZone,
        },
      });
    }

    return NextResponse.json({ error: "Action non reconnue." }, { status: 400 });
  } catch (error) {
    console.error("POST /api/auth error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'authentification." },
      { status: 500 }
    );
  }
}
