import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const fullName = String(process.env.ADMIN_NAME || "").trim();
const phone = String(process.env.ADMIN_PHONE || "").trim();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!email || !password || !fullName || !phone) {
  throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and ADMIN_PHONE before running this script.");
}
if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL is invalid.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT, rejectUnauthorized: true } : undefined });
try {
  const admins = await pool.query("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1");
  if (admins.rowCount) throw new Error("An admin account already exists. Refusing to create another automatically.");
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const passwordHash = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
  await pool.query(
    `INSERT INTO profiles (email, phone, full_name, password_hash, role, is_online, current_zone, is_active)
     VALUES ($1, $2, $3, $4, 'admin', false, 'Talborjt', true)`,
    [email, phone, fullName, passwordHash]
  );
  process.stdout.write(`Admin account created for ${email}. Store credentials securely and remove ADMIN_PASSWORD from your environment.\n`);
} finally {
  await pool.end();
}
