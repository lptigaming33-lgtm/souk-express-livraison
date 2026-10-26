import { cookies } from "next/headers";
import { db } from "@/db";
import { profiles, type UserRole } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSessionToken, verifySessionToken } from "./business-logic";

export const SESSION_COOKIE_NAME = "souk_express_session";

export interface AuthenticatedUser {
  id: number;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  driverCode: string | null;
  vehiclePlate: string | null;
  isOnline: boolean;
  currentZone: string | null;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const payload = verifySessionToken(token);
    if (!payload) return null;

    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      driverCode: user.driverCode,
      vehiclePlate: user.vehiclePlate,
      isOnline: user.isOnline,
      currentZone: user.currentZone,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  return user;
}

export async function setSessionCookie(user: {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
}) {
  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
