import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env");

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const users = [
  ["Demo Owner",         "owner@tastycorner.demo",    "9876543210", "Owner@123",   "OWNER"],
  ["Demo Manager One",   "manager1@tastycorner.demo", "9876543211", "Manager@123", "MANAGER"],
  ["Demo Manager Two",   "manager2@tastycorner.demo", "9876543212", "Manager@123", "MANAGER"],
  ["Demo Manager Three", "manager3@tastycorner.demo", "9876543213", "Manager@123", "MANAGER"],
] as const;

const categories = ["Burgers", "Pizza", "Sandwiches", "Juices", "Shakes", "Snacks", "Desserts"];

const items: [string, string, number, string][] = [
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

async function main() {
  console.log("Seeding database (Clean schema: No Restaurant table, No Session table)...\n");

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryMap = new Map<string, string>();
  for (const name of categories) {
    const category = await db.category.upsert({
      where:  { name },
      update: { isActive: true },
      create: { name },
    });
    categoryMap.set(name, category.id);
    console.log(`✓ Category: ${name}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  for (const [name, email, phone, password, role] of users) {
    const existing = await db.user.findUnique({
      where: { email },
    });
    if (!existing) {
      await db.user.create({
        data: {
          name,
          email,
          phone,
          password: await bcrypt.hash(password, 12),
          role,
        },
      });
      console.log(`✓ User created: ${name} (${role})`);
    } else {
      console.log(`→ User exists: ${email}`);
    }
  }

  // ── Menu Items ────────────────────────────────────────────────────────────
  for (const [name, category, price, description] of items) {
    const catId = categoryMap.get(category)!;
    const existing = await db.menuItem.findFirst({ where: { name } });
    if (!existing) {
      await db.menuItem.create({
        data: {
          name,
          description,
          price,
          categoryId: catId,
          isAvailable: true,
        },
      });
      console.log(`✓ Item created: ${name} — ₹${price}`);
    } else {
      console.log(`→ Item exists: ${name}`);
    }
  }

  console.log("\n✅ Seed complete!");
  console.log("──────────────────────────────────");
  console.log("Owner login details:");
  console.log("  Name    : Demo Owner");
  console.log("  Email   : owner@tastycorner.demo");
  console.log("  Phone   : 9876543210");
  console.log("  Password: Owner@123");
  console.log("──────────────────────────────────");
  console.log("Manager login details:");
  console.log("  Name    : Demo Manager One");
  console.log("  Email   : manager1@tastycorner.demo");
  console.log("  Phone   : 9876543211");
  console.log("  Password: Manager@123");
  console.log("──────────────────────────────────");
}

main()
  .catch((err) => { console.error("✗ Seed failed:", err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
