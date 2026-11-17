import { db } from "./server/src/db.js";

async function check() {
  try {
    const users = await db.user.findMany();
    console.log("Users in DB:", users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, token: u.token })));
    const categories = await db.category.findMany();
    console.log("Categories in DB:", categories.length);
    const items = await db.menuItem.findMany();
    console.log("Menu items in DB:", items.length);

    // Test updating token on first user
    if (users.length > 0) {
      const testToken = "test_token_123456";
      const updated = await db.user.update({
        where: { id: users[0].id },
        data: { token: testToken },
      });
      console.log("Token update test passed! User token:", updated.token);

      const found = await db.user.findFirst({ where: { token: testToken, isActive: true } });
      console.log("Find by token test passed! Found user:", found?.name);

      // Clean up token
      await db.user.update({
        where: { id: users[0].id },
        data: { token: null },
      });
      console.log("Token cleanup test passed!");
    }
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

check();

