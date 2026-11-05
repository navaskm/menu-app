/**
 * Direct seed runner — run with:
 *   node seed_runner.mjs
 * from the server directory (needs DATABASE_URL in .env)
 */
import { createRequire } from "module";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = resolve(__dirname, "../server/.env");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("✓ Loaded .env");
} catch (e) {
  console.error("Could not load .env:", e.message);
  process.exit(1);
}

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✓ set" : "✗ MISSING");
console.log("\nThis script just verifies env loading.");
console.log("To seed, run from server/ directory:");
console.log("  npx tsx prisma/seed.ts");

