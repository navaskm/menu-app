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
  if (process.env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production");

  console.log("Seeding database...\n");

  // ── Restaurant ────────────────────────────────────────────────────────────
  const restaurant = await db.restaurant.upsert({
    where:  { restaurantCode: "TASTY001" },
    update: { name: "Tasty Corner", tagline: "Freshly made, always worth it" },
    create: { name: "Tasty Corner", restaurantCode: "TASTY001", tagline: "Freshly made, always worth it" },
  });
  console.log(`✓ Restaurant: ${restaurant.name} (${restaurant.restaurantCode})`);

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryMap = new Map<string, string>();
  for (const name of categories) {
    const category = await db.category.upsert({
      where:  { restaurantId_name: { restaurantId: restaurant.id, name } },
      update: { isActive: true },
      create: { name, restaurantId: restaurant.id },
    });
    categoryMap.set(name, category.id);
    console.log(`✓ Category: ${name}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  for (const [name, email, phone, password, role] of users) {
    const existing = await db.user.findUnique({
      where: { restaurantId_email: { restaurantId: restaurant.id, email } },
    });
    if (!existing) {
      await db.user.create({
        data: { name, email, phone, password: await bcrypt.hash(password, 12), role, restaurantId: restaurant.id },
      });
      console.log(`✓ User created: ${name} (${role})`);
    } else {
      console.log(`→ User exists: ${email}`);
    }
  }

  // ── Menu Items ────────────────────────────────────────────────────────────
  for (const [name, category, price, description] of items) {
    const id = `${restaurant.id}-${name.toLowerCase().replaceAll(" ", "-")}`;
    const catId = categoryMap.get(category)!;
    await db.menuItem.upsert({
      where:  { id },
      update: { name, description, price },
      create: { id, name, description, price, categoryId: catId, restaurantId: restaurant.id, isAvailable: true },
    });
    console.log(`✓ Item: ${name} — ₹${price}`);
  }

  console.log("\n✅ Seed complete!");
  console.log("──────────────────────────────────");
  console.log("Demo login:");
  console.log("  Code    : TASTY001");
  console.log("  Email   : owner@tastycorner.demo");
  console.log("  Phone   : 9876543210");
  console.log("  Password: Owner@123");
  console.log("──────────────────────────────────");
}

main()
  .catch((err) => { console.error("✗ Seed failed:", err); process.exitCode = 1; })
  .finally(() => db.$disconnect());
