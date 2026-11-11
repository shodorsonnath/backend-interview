import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { requireAdmin, SESSION_COOKIE, type AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { message: "Too many login attempts", code: "RATE_LIMITED" } },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function sessionExpiry(): Date {
  return new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

function cookieOptions() {
  const secure = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        token,
        adminId: admin.id,
        expiresAt: sessionExpiry(),
      },
    });

    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({
      admin: { id: admin.id, email: admin.email },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAdmin, async (req: AuthRequest, res) => {
  res.json({ admin: req.admin });
});

authRouter.post("/logout", requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } });
    }
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
