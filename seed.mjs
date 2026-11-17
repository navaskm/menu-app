/**
 * seed.mjs  —  Tasty Corner database setup & seed
 * Drops old Restaurant and Session tables, creates clean tables, and seeds data.
 *
 * Run from anywhere with:
 *   node seed.mjs
 */

import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { createHash, randomBytes } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "server/.env");
try {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("✓ Loaded server/.env");
} catch (e) {
  console.error("✗ Could not load server/.env:", e.message);
  process.exit(1);
}

const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL not set in server/.env");
  process.exit(1);
}
console.log("✓ DATABASE_URL found");

// ── Load database client ──────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
let Client;
try {
  const neon = require(resolve(__dirname, "server/node_modules/@neondatabase/serverless"));
  Client = neon.Client;
  console.log("✓ Using @neondatabase/serverless");
} catch {
  try {
    const pg = require(resolve(__dirname, "server/node_modules/pg"));
    Client = pg.Client;
    console.log("✓ Using pg");
  } catch {
    try {
      const pg = require("pg");
      Client = pg.Client;
      console.log("✓ Using global pg");
    } catch {
      console.error("✗ No database driver found. Run: npm install in server/");
      process.exit(1);
    }
  }
}

// ── bcrypt ───────────────────────────────────────────────────────────────────
let bcrypt;
try {
  bcrypt = require(resolve(__dirname, "server/node_modules/bcrypt"));
} catch {
  try { bcrypt = require("bcrypt"); } catch { bcrypt = null; }
}

function cuid() {
  const ts = Date.now().toString(36);
  const rnd = randomBytes(8).toString("base64url").slice(0, 8);
  return `c${ts}${rnd}`;
}

async function hashPw(password) {
  if (bcrypt) return bcrypt.hash(password, 12);
  console.warn("  ⚠ bcrypt not found — using SHA256 hash (demo only)");
  return createHash("sha256").update(password).digest("hex");
}

// ── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ["Burgers", "Pizza", "Sandwiches", "Juices", "Shakes", "Snacks", "Desserts"];

const USERS = [
  { name: "Demo Owner",         email: "owner@tastycorner.demo",    phone: "9876543210", password: "Owner@123",   role: "OWNER" },
  { name: "Demo Manager One",   email: "manager1@tastycorner.demo", phone: "9876543211", password: "Manager@123", role: "MANAGER" },
  { name: "Demo Manager Two",   email: "manager2@tastycorner.demo", phone: "9876543212", password: "Manager@123", role: "MANAGER" },
  { name: "Demo Manager Three", email: "manager3@tastycorner.demo", phone: "9876543213", password: "Manager@123", role: "MANAGER" },
];

const ITEMS = [
  ["Smoky Chicken Burger",  "Burgers",    220, "Char-grilled chicken, smoked mayo, crisp lettuce and pickles."],
  ["Kerala Beef Burger",    "Burgers",    260, "Spiced beef patty, caramelised onions and house pepper sauce."],
  ["Garden Veg Burger",     "Burgers",    180, "Crispy vegetable patty, cheddar, tomato and fresh greens."],
  ["Malabar Chicken Pizza", "Pizza",      340, "Roasted chicken, mozzarella, herbs and a gentle chilli kick."],
  ["Four Cheese Pizza",     "Pizza",      390, "A rich blend of mozzarella, cheddar, parmesan and blue cheese."],
  ["Classic Club Sandwich", "Sandwiches", 240, "Triple-layered toast with chicken, egg, tomato and fries."],
  ["Paneer Tikka Sandwich", "Sandwiches", 210, "Spiced paneer, crunchy onions and mint chutney in toasted bread."],
  ["Fresh Lime Soda",       "Juices",      90, "Fresh lime, soda and a pinch of salt. Sweet or salted."],
  ["Mango Juice",           "Juices",     130, "Thick, chilled Alphonso mango juice with no added colour."],
  ["Watermelon Juice",      "Juices",     110, "Cool, refreshing watermelon juice served chilled."],
  ["Chocolate Shake",       "Shakes",     190, "Creamy Belgian chocolate shake topped with chocolate curls."],
  ["Vanilla Shake",         "Shakes",     180, "Classic vanilla milkshake, thick and cold."],
  ["Crispy Chicken Nuggets","Snacks",     160, "Golden, crunchy bites served with our signature dip."],
  ["Loaded French Fries",   "Snacks",     150, "Crispy fries, cheese sauce, spring onions and jalapeños."],
  ["Warm Fudge Brownie",    "Desserts",   170, "Soft chocolate brownie served warm with vanilla ice cream."],
];

// ── SQL: Drop Restaurant and Session tables, create clean schema ───────────────
const CLEAN_SQL = `
-- 1. Remove Session and Restaurant tables completely as requested
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Restaurant" CASCADE;

-- 2. Drop existing dependent tables to ensure clean structure without restaurantId
DROP TABLE IF EXISTS "MenuItem" CASCADE;
DROP TABLE IF EXISTS "Category" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER');
  END IF;
END $$;

-- 3. Clean User table (with persistent token column)
CREATE TABLE "User" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL UNIQUE,
  "phone"     TEXT NOT NULL UNIQUE,
  "password"  TEXT NOT NULL,
  "role"      "Role" NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,
  "token"     TEXT UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- 4. Clean Category table
CREATE TABLE "Category" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Category_isActive_idx" ON "Category"("isActive");

-- 5. Clean MenuItem table
CREATE TABLE "MenuItem" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price"       DECIMAL(10,2) NOT NULL,
  "imageUrl"    TEXT,
  "imageKey"    TEXT,
  "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
  "categoryId"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_isAvailable_idx" ON "MenuItem"("categoryId", "isAvailable");
CREATE INDEX IF NOT EXISTS "MenuItem_name_idx" ON "MenuItem"("name");

-- 6. UploadCleanup table
CREATE TABLE IF NOT EXISTS "UploadCleanup" (
  "id"        TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
`;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("✓ Connected to database");

  console.log("\n── Removing Restaurant & Session tables, applying clean schema…");
  await client.query(CLEAN_SQL);
  console.log("✓ Restaurant and Session tables removed!");
  console.log("✓ Clean User, Category, and MenuItem tables created!");

  // Seed categories
  console.log("\n── Seeding categories…");
  const categoryMap = {};
  for (const name of CATEGORIES) {
    const id = cuid();
    const { rows: [cat] } = await client.query(`
      INSERT INTO "Category" ("id", "name", "updatedAt")
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT ("name") DO UPDATE SET "isActive" = TRUE, "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `, [id, name]);
    categoryMap[name] = cat.id;
    console.log(`  ✓ Category: ${name}`);
  }

  // Seed users
  console.log("\n── Seeding users…");
  for (const u of USERS) {
    const hashed = await hashPw(u.password);
    await client.query(`
      INSERT INTO "User" ("id", "name", "email", "phone", "password", "role", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6::\"Role\", CURRENT_TIMESTAMP)
      ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name", "phone" = EXCLUDED."phone", "updatedAt" = CURRENT_TIMESTAMP
    `, [cuid(), u.name, u.email, u.phone, hashed, u.role]);
    console.log(`  ✓ User: ${u.name} (${u.role})`);
  }

  // Seed menu items
  console.log("\n── Seeding menu items…");
  for (const [name, cat, price, description] of ITEMS) {
    const catId = categoryMap[cat];
    if (!catId) continue;
    const id = cuid();
    await client.query(`
      INSERT INTO "MenuItem" ("id", "name", "description", "price", "categoryId", "isAvailable", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
    `, [id, name, description, price, catId]);
    console.log(`  ✓ ${name} — ₹${price}`);
  }

  await client.end();
  console.log("\n✅ Database updated and seeded successfully!");
  console.log("─────────────────────────────────────────────");
  console.log("Owner login details:");
  console.log("  Name    : Demo Owner");
  console.log("  Email   : owner@tastycorner.demo");
  console.log("  Phone   : 9876543210");
  console.log("  Password: Owner@123");
  console.log("─────────────────────────────────────────────");
  console.log("Manager login details:");
  console.log("  Name    : Demo Manager One");
  console.log("  Email   : manager1@tastycorner.demo");
  console.log("  Phone   : 9876543211");
  console.log("  Password: Manager@123");
  console.log("─────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  console.error(err);
  process.exit(1);
});
