import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { jwtVerify } from "jose";

import type { Config } from "../config/env.ts";
import { Admin, RateBucket, User } from "../models/index.ts";
import { AppError } from "../utils/http.ts";

export type AdminIdentity = { id: string; email: string; name: string };

export type UserIdentity = {
  id: string;
  email?: string;
  name: string;
  avatarUrl: string;
  bio: string;
  location: string;
  locale: "vi" | "en";
};

declare global {
  namespace Express {
    interface Locals {
      admin?: AdminIdentity;
      user?: UserIdentity;
    }
  }
}

export function originGuard(config: Config) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.headers.origin !== config.FRONTEND_URL)
      return next(new AppError(403, "Nguồn yêu cầu không hợp lệ."));
    next();
  };
}

export async function authenticate(
  req: Request,
  config: Config,
): Promise<AdminIdentity> {
  try {
    const token = req.cookies?.atlas_session;
    if (typeof token !== "string") throw new Error();
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.JWT_SECRET),
      { issuer: "vietnam-heritage", audience: "admin", algorithms: ["HS256"] },
    );
    if (!mongoose.isValidObjectId(payload.sub)) throw new Error();
    const user = await Admin.findOne({
      _id: payload.sub,
      active: true,
      sessionVersion: payload.version,
    }).lean<{ _id: string; email: string; name: string }>();
    if (!user || payload.role !== "admin") throw new Error();
    return { id: String(user._id), email: user.email, name: user.name };
  } catch {
    throw new AppError(401, "Vui lòng đăng nhập lại.");
  }
}

export function requireAdmin(config: Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.admin = await authenticate(req, config);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function authenticateUser(
  req: Request,
  config: Config,
): Promise<UserIdentity> {
  try {
    const token = req.cookies?.heritage_user_session;
    if (typeof token !== "string") throw new Error();
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.JWT_SECRET),
      { issuer: "vietnam-heritage", audience: "user", algorithms: ["HS256"] },
    );
    if (!mongoose.isValidObjectId(payload.sub)) throw new Error();
    const user = await User.findOne({
      _id: payload.sub,
      active: true,
      sessionVersion: payload.version,
    }).lean<{
      _id: string;
      email?: string;
      name: string;
      avatarUrl: string;
      bio: string;
      location: string;
      locale: "vi" | "en";
    }>();
    if (!user || payload.role !== "user") throw new Error();
    return {
      id: String(user._id),
      ...(user.email ? { email: user.email } : {}),
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      locale: user.locale,
    };
  } catch {
    throw new AppError(401, "Vui lòng đăng nhập để tiếp tục.");
  }
}

export function requireUser(config: Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals.user = await authenticateUser(req, config);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function persistentLimit(scope: string, max: number, windowMs = 900000) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const bucket = Math.floor(Date.now() / windowMs);
      const key = createHash("sha256")
        .update(`${scope}:${req.ip}:${bucket}`)
        .digest("hex");
      const row = await RateBucket.findOneAndUpdate(
        { _id: key },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
        },
        { upsert: true, new: true },
      );
      if (row.count > max)
        throw new AppError(
          429,
          "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
        );
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function rejectOperators(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectOperators);
    return;
  }

  if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (
        key.startsWith("$") ||
        key.includes(".") ||
        ["__proto__", "prototype", "constructor"].includes(key)
      )
        throw new AppError(400, "Trường dữ liệu không hợp lệ.");
      rejectOperators(item);
    }
}
