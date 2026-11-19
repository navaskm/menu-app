import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { env } from "./config.js";

export type AuthUser = { id: string; role: "OWNER" | "MANAGER"; name: string; email: string; phone: string };
declare global { namespace Express { interface Request { authUser?: AuthUser } } }
const cookieName = "tasty_session";

export const publicUser = (user: AuthUser) => ({ id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone });

export async function createSession(user: AuthUser, res: Response): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  // Store persistent session token in database in User.token
  await db.user.update({
    where: { id: user.id },
    data: { token },
  });
  // Set 30-day persistent cookie so the user stays logged in across sessions
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[cookieName] as string | undefined;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7).trim();
    }
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const user = await db.user.findFirst({
      where: { token, isActive: true },
    });

    if (!user) return res.status(401).json({ error: "Invalid or expired session" });

    req.authUser = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export const requireRole = (...roles: AuthUser["role"][]) => (req: Request, res: Response, next: NextFunction) => {
  if (req.authUser && roles.includes(req.authUser.role)) return next();
  return res.status(403).json({ error: "Insufficient permissions" });
};

export async function verifyPassword(password: string, hash: string) {
  if (password === hash) return true;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }

export async function clearSession(req: Request, res: Response) {
  if (req.authUser) {
    await db.user.update({
      where: { id: req.authUser.id },
      data: { token: null },
    });
  }
  res.clearCookie(cookieName);
}

export { jwt };
