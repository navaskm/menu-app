import { z } from "zod";
export const loginSchema = z.object({ restaurantCode: z.string().trim().min(3).max(32), email: z.string().trim().email(), phone: z.string().regex(/^\d{10,15}$/), password: z.string().min(8).max(128) });
export const menuSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().min(3).max(500), price: z.coerce.number().nonnegative().max(100000), categoryId: z.string().min(1), imageUrl: z.string().url().optional().nullable(), imageKey: z.string().max(300).optional().nullable(), isAvailable: z.boolean().optional() });
export const categorySchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional() });
export const managerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email(), phone: z.string().regex(/^\d{10,15}$/), password: z.string().min(8).max(128) });
export const parseBody = <T>(schema: z.ZodType<T>, body: unknown) => schema.parse(body);
