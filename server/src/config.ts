import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32).default("development-only-change-this-secret-32"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(), CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(), CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(), CLOUDFLARE_R2_PUBLIC_URL: z.string().url().optional(),
});
export const env = schema.parse(process.env);
