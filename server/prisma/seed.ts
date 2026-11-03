import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";
const db = new PrismaClient();
const users = [
  ["Demo Owner", "owner@tastycorner.demo", "9876543210", "Owner@123", "OWNER"],
  ["Demo Manager One", "manager1@tastycorner.demo", "9876543211", "Manager@123", "MANAGER"],
  ["Demo Manager Two", "manager2@tastycorner.demo", "9876543212", "Manager@123", "MANAGER"],
  ["Demo Manager Three", "manager3@tastycorner.demo", "9876543213", "Manager@123", "MANAGER"],
] as const;
const categories = ["Burgers", "Pizza", "Sandwiches", "Juices", "Shakes", "Snacks", "Desserts"];
const items = [
  ["Smoky Chicken Burger", "Burgers", 220], ["Kerala Beef Burger", "Burgers", 260], ["Garden Veg Burger", "Burgers", 180], ["Malabar Chicken Pizza", "Pizza", 340], ["Four Cheese Pizza", "Pizza", 390], ["Classic Club Sandwich", "Sandwiches", 240], ["Fresh Lime Soda", "Juices", 90], ["Mango Juice", "Juices", 130], ["Chocolate Shake", "Shakes", 190], ["Crispy Chicken Nuggets", "Snacks", 160], ["Loaded French Fries", "Snacks", 150], ["Warm Fudge Brownie", "Desserts", 170], ["Vanilla Shake", "Shakes", 180], ["Watermelon Juice", "Juices", 110], ["Paneer Tikka Sandwich", "Sandwiches", 210],
] as const;
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production");
  const restaurant = await db.restaurant.upsert({ where: { restaurantCode: "TASTY001" }, update: { name: "Tasty Corner" }, create: { name: "Tasty Corner", restaurantCode: "TASTY001", tagline: "Freshly made, always worth it" } });
  const categoryMap = new Map<string, string>();
  for (const name of categories) { const category = await db.category.upsert({ where: { restaurantId_name: { restaurantId: restaurant.id, name } }, update: { isActive: true }, create: { name, restaurantId: restaurant.id } }); categoryMap.set(name, category.id); }
  for (const [name, email, phone, password, role] of users) { const existing = await db.user.findUnique({ where: { restaurantId_email: { restaurantId: restaurant.id, email } } }); if (!existing) await db.user.create({ data: { name, email, phone, password: await bcrypt.hash(password, 12), role, restaurantId: restaurant.id } }); }
  for (const [name, category, price] of items) await db.menuItem.upsert({ where: { id: `${restaurant.id}-${name.toLowerCase().replaceAll(" ", "-")}` }, update: {}, create: { id: `${restaurant.id}-${name.toLowerCase().replaceAll(" ", "-")}`, name, description: `A Tasty Corner favourite made fresh to order.`, price, categoryId: categoryMap.get(category)!, restaurantId: restaurant.id, isAvailable: true } });
  console.log("Development demo seed completed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
