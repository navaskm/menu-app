import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { env } from "./config.js";

export type AuthUser = { id: string; role: "OWNER" | "MANAGER"; restaurantId: string; name: string; email: string; phone: string };
declare global { namespace Express { interface Request { authUser?: AuthUser } } }
const cookieName = "tasty_session";
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const publicUser = (user: AuthUser) => ({ id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone, restaurantId: user.restaurantId });

export async function createSession(user: AuthUser, res: Response) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await db.session.create({ data: { tokenHash: hashToken(rawToken), userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12) } });
  res.cookie(cookieName, rawToken, { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", maxAge: 1000 * 60 * 60 * 12 });
}
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[cookieName] as string | undefined;
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) return res.status(401).json({ error: "Authentication required" });
    req.authUser = { id: session.user.id, role: session.user.role, restaurantId: session.user.restaurantId, name: session.user.name, email: session.user.email, phone: session.user.phone };
    next();
  } catch (error) { next(error); }
}
export const requireRole = (...roles: AuthUser["role"][]) => (req: Request, res: Response, next: NextFunction) => req.authUser && roles.includes(req.authUser.role) ? next() : res.status(403).json({ error: "Insufficient permissions" });
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function clearSession(req: Request, res: Response) { const token = req.cookies?.[cookieName] as string | undefined; if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } }); res.clearCookie(cookieName); }
export { jwt };
