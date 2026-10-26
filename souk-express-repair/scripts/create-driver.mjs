import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";

// Provisions ONE real delivery driver (drivers cannot sign up from the public app).
const { Pool } = pg;
const email = String(process.env.DRIVER_EMAIL || "").trim().toLowerCase();
const password = String(process.env.DRIVER_PASSWORD || "");
const fullName = String(process.env.DRIVER_NAME || "").trim();
const phone = String(process.env.DRIVER_PHONE || "").trim();
const driverCode = String(process.env.DRIVER_CODE || "").trim();
const vehiclePlate = String(process.env.DRIVER_PLATE || "").trim();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!email || !password || !fullName || !phone || !driverCode) {
  throw new Error("Set DRIVER_EMAIL, DRIVER_PASSWORD, DRIVER_NAME, DRIVER_PHONE and DRIVER_CODE (DRIVER_PLATE optional).");
}
if (password.length < 12) throw new Error("DRIVER_PASSWORD must contain at least 12 characters.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("DRIVER_EMAIL is invalid.");

const ssl = process.env.DATABASE_CA_CERT
  ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true }
  : undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
try {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const passwordHash = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
  await pool.query(
    `INSERT INTO profiles (email, phone, full_name, password_hash, role, driver_code, vehicle_plate, is_online, current_zone, is_active)
     VALUES ($1, $2, $3, $4, 'driver', $5, $6, false, 'Talborjt', true)`,
    [email, phone, fullName, passwordHash, driverCode, vehiclePlate || null]
  );
  process.stdout.write(`Driver ${driverCode} created for ${email}. Remove DRIVER_PASSWORD from your environment.\n`);
} finally {
  await pool.end();
}
