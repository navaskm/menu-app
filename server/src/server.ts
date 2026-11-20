import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { db } from "./db.js";
import { env } from "./config.js";
import { clearSession, createSession, hashPassword, publicUser, requireAuth, requireRole, verifyPassword } from "./auth.js";
import { categorySchema, createManagerSchema, loginSchema, managerSchema, menuSchema, parseBody, updateManagerSchema } from "./validators.js";

const app = express();
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  message: { error: "Too many login attempts. Try again later." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

const cleanItem = (item: {
  id: string;
  name: string;
  description: string;
  price: unknown;
  imageUrl: string | null;
  isAvailable: boolean;
  category: { id: string; name: string };
}) => ({ ...item, price: Number(item.price) });

// ── Public endpoints ──────────────────────────────────────────────────────────

app.get("/api/restaurant", (_req, res) => {
  res.json({
    data: {
      name: "Tasty Corner",
      tagline: "Freshly made, always worth it",
      logo: null,
    },
  });
});

app.get("/api/categories", async (_req, res, next) => {
  try {
    const data = await db.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.get("/api/menu", async (_req, res, next) => {
  try {
    const data = (await db.menuItem.findMany({
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })).map(cleanItem);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.get("/api/menu/:id", async (req, res, next) => {
  try {
    const item = await db.menuItem.findUnique({
      where: { id: req.params.id },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!item) return res.status(404).json({ error: "Menu item not found" });
    res.json({ data: cleanItem(item) });
  } catch (e) {
    next(e);
  }
});

// ── Authentication ───────────────────────────────────────────────────────────

app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const input = parseBody(loginSchema, req.body);
    const user = await db.user.findFirst({
      where: {
        email: input.email.toLowerCase(),
        phone: input.phone,
      },
    });

    if (!user) return res.status(401).json({ error: "Invalid login details (email or phone not found)" });

    if (user.role === "MANAGER") {
      const hasPassword = Boolean(user.password && user.password.trim() !== "");

      if (!hasPassword) {
        // First-time login: manager can set their own name and password
        const updates: { name?: string; password?: string } = {};
        if (input.name && input.name.trim()) {
          updates.name = input.name.trim();
        }
        if (input.password && input.password.trim()) {
          updates.password = input.password.trim();
        }
        if (Object.keys(updates).length > 0) {
          await db.user.update({
            where: { id: user.id },
            data: updates,
          });
          if (updates.name !== undefined) user.name = updates.name;
          if (updates.password !== undefined) user.password = updates.password;
        }
      } else {
        // Second-time & subsequent logins:
        // Must match 3 fields: email, phone, and password (do NOT check name)
        if (!input.password || !(await verifyPassword(input.password, user.password))) {
          return res.status(401).json({ error: "Invalid login details (incorrect password)" });
        }
        // If manager didn't have a name set yet and provided one, save it
        if ((!user.name || user.name.trim() === "") && input.name && input.name.trim()) {
          await db.user.update({
            where: { id: user.id },
            data: { name: input.name.trim() },
          });
          user.name = input.name.trim();
        }
      }
    } else {
      // OWNER login: verify name and password
      if (input.name && input.name.trim() && user.name.trim().toLowerCase() !== input.name.trim().toLowerCase()) {
        return res.status(401).json({ error: "Invalid login details (name mismatch)" });
      }
      if (!(await verifyPassword(input.password, user.password))) {
        return res.status(401).json({ error: "Invalid login details (incorrect password)" });
      }
    }

    const authUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    } as const;

    // Creates persistent 30-day session saved in User.token and httpOnly cookie
    const token = await createSession(authUser, res);

    res.json({
      data: {
        user: publicUser(authUser),
        token,
        redirectTo: user.role === "OWNER" ? "/dashboard/owner" : "/dashboard/manager",
      },
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res, next) => {
  try {
    await clearSession(req, res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ data: req.authUser });
});

// ── Menu Management (Owner & Manager) ────────────────────────────────────────

app.post("/api/menu", requireAuth, async (req, res, next) => {
  try {
    const input = parseBody(menuSchema, req.body);
    const category = await db.category.findFirst({
      where: { id: input.categoryId, isActive: true },
    });
    if (!category) return res.status(400).json({ error: "Invalid category" });

    const item = await db.menuItem.create({
      data: {
        name: input.name,
        description: input.description,
        price: input.price,
        imageUrl: input.imageUrl || null,
        imageKey: input.imageKey || null,
        isAvailable: input.isAvailable ?? true,
        categoryId: category.id,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    res.status(201).json({ data: cleanItem(item) });
  } catch (e) {
    next(e);
  }
});

app.put("/api/menu/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = parseBody(menuSchema.partial(), req.body);
    const existing = await db.menuItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Menu item not found" });

    const item = await db.menuItem.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
        ...(input.imageKey !== undefined ? { imageKey: input.imageKey || null } : {}),
        ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });
    res.json({ data: cleanItem(item) });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/menu/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const item = await db.menuItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    await db.menuItem.delete({ where: { id: item.id } });
    if (item.imageKey) await db.uploadCleanup.create({ data: { objectKey: item.imageKey } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

app.patch("/api/menu/:id/availability", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = z.object({ isAvailable: z.boolean() }).parse(req.body);
    const item = await db.menuItem.update({
      where: { id },
      data: { isAvailable: input.isAvailable },
    });
    res.json({ data: { isAvailable: item.isAvailable } });
  } catch (e) {
    next(e);
  }
});

// ── Category Management (Owner & Manager) ────────────────────────────────────

app.post("/api/categories", requireAuth, async (req, res, next) => {
  try {
    const input = parseBody(categorySchema, req.body);
    const existing = await db.category.findUnique({ where: { name: input.name } });
    if (existing) return res.status(409).json({ error: "Category already exists" });

    const data = await db.category.create({
      data: {
        name: input.name,
        description: input.description || null,
      },
    });
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
});

app.put("/api/categories/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = parseBody(categorySchema.partial(), req.body);
    const data = await db.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/categories/:id", requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const category = await db.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: "Category not found" });

    const itemCount = await db.menuItem.count({ where: { categoryId: category.id } });
    if (itemCount > 0) {
      return res.status(409).json({ error: `Cannot delete category: contains ${itemCount} menu item(s). Reassign or delete them first.` });
    }
    await db.category.delete({ where: { id: category.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// ── Managers Management (Owner Only) ─────────────────────────────────────────

app.get("/api/managers", requireAuth, requireRole("OWNER"), async (_req, res, next) => {
  try {
    const data = await db.user.findMany({
      where: { role: "MANAGER" },
      select: { id: true, name: true, email: true, phone: true, password: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.post("/api/managers", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const input = parseBody(createManagerSchema, req.body);
    const existingEmail = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existingEmail) return res.status(409).json({ error: "Email already registered" });
    const existingPhone = await db.user.findUnique({ where: { phone: input.phone } });
    if (existingPhone) return res.status(409).json({ error: "Phone number already registered" });

    const data = await db.user.create({
      data: {
        name: "",
        email: input.email.toLowerCase(),
        phone: input.phone,
        role: "MANAGER",
        password: "",
        isActive: true,
      },
      select: { id: true, name: true, email: true, phone: true, password: true, role: true, createdAt: true },
    });
    res.status(201).json({ data });
  } catch (e) {
    next(e);
  }
});

app.put("/api/managers/:id", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = parseBody(updateManagerSchema, req.body);

    const manager = await db.user.findFirst({ where: { id, role: "MANAGER" } });
    if (!manager) return res.status(404).json({ error: "Manager not found" });

    if (input.email && input.email.toLowerCase() !== manager.email.toLowerCase()) {
      const existingEmail = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
      if (existingEmail) return res.status(409).json({ error: "Email already registered" });
    }

    if (input.phone && input.phone !== manager.phone) {
      const existingPhone = await db.user.findUnique({ where: { phone: input.phone } });
      if (existingPhone) return res.status(409).json({ error: "Phone number already registered" });
    }

    const data = await db.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email ? { email: input.email.toLowerCase() } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, password: true, role: true, createdAt: true },
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/managers/:id", requireAuth, requireRole("OWNER"), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await db.user.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// ── Image Uploads ────────────────────────────────────────────────────────────

const s3 = env.CLOUDFLARE_R2_ACCOUNT_ID && env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY && env.CLOUDFLARE_R2_BUCKET_NAME
  ? new S3Client({
      region: "auto",
      endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

app.post("/api/uploads", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!s3 || !env.CLOUDFLARE_R2_BUCKET_NAME || !env.CLOUDFLARE_R2_PUBLIC_URL || !req.file) {
      return res.status(503).json({ error: "Image storage is not configured" });
    }
    const extension = req.file.mimetype.split("/")[1];
    const key = `menu/${crypto.randomUUID()}.${extension}`;
    await s3.send(new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));
    res.status(201).json({ data: { key, url: `${env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, "")}/${key}` } });
  } catch (e) {
    next(e);
  }
});

// ── Error handling ───────────────────────────────────────────────────────────

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  const isValidation = error instanceof z.ZodError;
  res.status(isValidation ? 400 : 500).json({
    error: isValidation ? error.issues.map((i) => i.message).join(", ") : "Unexpected server error",
  });
});

app.listen(env.PORT, () => console.log(`Tasty Corner API listening on http://localhost:${env.PORT}`));
