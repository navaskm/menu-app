import { z } from "zod";

export const loginSchema = z.object({
  name: z.string().trim().optional().default(""),
  email: z.string().trim().email("Invalid email"),
  phone: z.string().regex(/^\d{10,15}$/, "10 to 15 digit phone number required"),
  password: z.string().optional().default(""),
});

export const menuSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(500),
  price: z.coerce.number().nonnegative().max(100000),
  categoryId: z.string().min(1, "Category is required"),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  imageKey: z.string().max(300).optional().nullable(),
  isAvailable: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().nullable().or(z.literal("")),
});

export const createManagerSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  phone: z.string().regex(/^\d{10,15}$/, "10 to 15 digit phone number required"),
});

export const updateManagerSchema = z.object({
  name: z.string().trim().optional().default(""),
  email: z.string().trim().email("Invalid email").optional(),
  phone: z.string().regex(/^\d{10,15}$/, "10 to 15 digit phone number required").optional(),
  password: z.string().optional().default(""),
});

export const managerSchema = z.object({
  name: z.string().trim().optional().default(""),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10,15}$/, "10 to 15 digit phone number required"),
  password: z.string().optional().default(""),
});

export const parseBody = <T>(schema: z.ZodType<T>, body: unknown) => schema.parse(body);
