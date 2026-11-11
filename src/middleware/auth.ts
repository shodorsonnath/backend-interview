import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

export const SESSION_COOKIE = "session";

export type AuthRequest = Request & {
  admin?: { id: string; email: string };
  sessionId?: string;
};

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || typeof token !== "string") {
      throw new AppError(401, "Not authenticated", "UNAUTHORIZED");
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
      throw new AppError(401, "Session expired", "SESSION_EXPIRED");
    }

    req.admin = { id: session.admin.id, email: session.admin.email };
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}
