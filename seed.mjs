/**
 * seed.mjs  —  Tasty Corner database setup & seed
 *
 * Run from anywhere with:
 *   node seed.mjs
 *
 * Requirements: node 18+ (built-in fetch not needed, uses pg via node)
 * The pg package comes pre-installed as a transitive dep of @prisma/adapter-neon
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
  console.log("✓ Loaded .env");
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
  // @neondatabase/serverless is already installed (dep of @prisma/adapter-neon)
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
  // Simple cuid-like unique ID
  const ts = Date.now().toString(36);
  const rnd = randomBytes(8).toString("base64url").slice(0, 8);
  return `c${ts}${rnd}`;
}

async function hashPw(password) {
  if (bcrypt) return bcrypt.hash(password, 12);
  // Fallback: SHA256 (not production-safe, only for demo if bcrypt missing)
  console.warn("  ⚠ bcrypt not found — using SHA256 hash (demo only)");
  return createHash("sha256").update(password).digest("hex");
}

// ── Data ─────────────────────────────────────────────────────────────────────
const RESTAURANT_CODE = "TASTY001";
const CATEGORIES = ["Burgers", "Pizza", "Sandwiches", "Juices", "Shakes", "Snacks", "Desserts"];
const USERS = [
  { name: "Demo Owner",        email: "owner@tastycorner.demo",    phone: "9876543210", password: "Owner@123",   role: "OWNER" },
  { name: "Demo Manager One",  email: "manager1@tastycorner.demo", phone: "9876543211", password: "Manager@123", role: "MANAGER" },
  { name: "Demo Manager Two",  email: "manager2@tastycorner.demo", phone: "9876543212", password: "Manager@123", role: "MANAGER" },
  { name: "Demo Manager Three",email: "manager3@tastycorner.demo", phone: "9876543213", password: "Manager@123", role: "MANAGER" },
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

// ── Migration SQL ─────────────────────────────────────────────────────────────
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "Restaurant" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name"           TEXT NOT NULL,
  "restaurantCode" TEXT NOT NULL UNIQUE,
  "logo"           TEXT,
  "tagline"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "phone"        TEXT NOT NULL,
  "password"     TEXT NOT NULL,
  "role"         "Role" NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "restaurantId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("restaurantId", "email"),
  UNIQUE ("restaurantId", "phone"),
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id"        TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Category" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "restaurantId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("restaurantId", "name"),
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "price"        DECIMAL(10,2) NOT NULL,
  "imageUrl"     TEXT,
  "imageKey"     TEXT,
  "isAvailable"  BOOLEAN NOT NULL DEFAULT TRUE,
  "categoryId"   TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("categoryId")   REFERENCES "Category"("id")   ON DELETE RESTRICT,
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "UploadCleanup" (
  "id"        TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                      TEXT NOT NULL,
  "checksum"                TEXT NOT NULL,
  "finished_at"             TIMESTAMPTZ,
  "migration_name"          TEXT NOT NULL,
  "logs"                    TEXT,
  "rolled_back_at"          TIMESTAMPTZ,
  "started_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count"     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
`;

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("✓ Connected to database");

  // Run migrations
  console.log("\n── Creating tables (if not exist)…");
  await client.query(MIGRATION_SQL);
  console.log("✓ Tables ready");

  // Upsert restaurant
  console.log("\n── Seeding restaurant…");
  const { rows: [restaurant] } = await client.query(`
    INSERT INTO "Restaurant" ("id", "name", "restaurantCode", "tagline", "updatedAt")
    VALUES ($1, 'Tasty Corner', 'TASTY001', 'Freshly made, always worth it', CURRENT_TIMESTAMP)
    ON CONFLICT ("restaurantCode") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `, [cuid()]);
  console.log(`  ✓ Restaurant: ${restaurant.name} (${restaurant.restaurantCode})`);

  // Upsert categories
  console.log("\n── Seeding categories…");
  const categoryMap = {};
  for (const name of CATEGORIES) {
    const { rows: [cat] } = await client.query(`
      INSERT INTO "Category" ("id", "name", "restaurantId", "updatedAt")
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT ("restaurantId", "name") DO UPDATE SET "isActive" = TRUE, "updatedAt" = CURRENT_TIMESTAMP
      RETURNING *
    `, [cuid(), name, restaurant.id]);
    categoryMap[name] = cat.id;
    console.log(`  ✓ Category: ${name}`);
  }

  // Upsert users
  console.log("\n── Seeding users…");
  for (const u of USERS) {
    const existing = await client.query(
      `SELECT id FROM "User" WHERE "restaurantId" = $1 AND "email" = $2`,
      [restaurant.id, u.email]
    );
    if (existing.rows.length === 0) {
      const hashed = await hashPw(u.password);
      await client.query(`
        INSERT INTO "User" ("id","name","email","phone","password","role","restaurantId","updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6::\"Role\",$7,CURRENT_TIMESTAMP)
      `, [cuid(), u.name, u.email, u.phone, hashed, u.role, restaurant.id]);
      console.log(`  ✓ Created user: ${u.name} (${u.role})`);
    } else {
      console.log(`  → Skipped (exists): ${u.email}`);
    }
  }

  // Upsert menu items
  console.log("\n── Seeding menu items…");
  for (const [name, cat, price, description] of ITEMS) {
    const slug = `${restaurant.id}-${name.toLowerCase().replaceAll(" ", "-")}`;
    const catId = categoryMap[cat];
    if (!catId) { console.warn(`  ✗ Category not found: ${cat}`); continue; }
    await client.query(`
      INSERT INTO "MenuItem" ("id","name","description","price","categoryId","restaurantId","isAvailable","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,TRUE,CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "updatedAt"=CURRENT_TIMESTAMP
    `, [slug, name, description, price, catId, restaurant.id]);
    console.log(`  ✓ ${name} — ₹${price}`);
  }

  await client.end();
  console.log("\n✅ Database seeded successfully!\n");
  console.log("Demo login credentials:");
  console.log("  Restaurant Code : TASTY001");
  console.log("  Email           : owner@tastycorner.demo");
  console.log("  Phone           : 9876543210");
  console.log("  Password        : Owner@123\n");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message);
  console.error(err);
  process.exit(1);
});
