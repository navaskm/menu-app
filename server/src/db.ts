import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./config.js";

const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
export const db = new PrismaClient({ adapter });
