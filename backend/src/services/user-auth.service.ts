import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";

import type { Config } from "../config/env.ts";
import type { UserIdentity } from "../middleware/security.ts";
import { OAuthAccount, User } from "../models/index.ts";
import { AppError } from "../utils/http.ts";

export type OAuthProvider = "google" | "facebook";

type UserRecord = {
  _id: unknown;
  email?: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  locale?: "vi" | "en";
  sessionVersion: number;
  active: boolean;
  passwordHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
};

let dummyPasswordHash: Promise<string> | undefined;

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    location: z.string().trim().max(120).optional(),
    locale: z.enum(["vi", "en"]).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "No profile changes provided",
  );

function toProfile(user: UserRecord): UserIdentity {
  return {
    id: String(user._id),
    ...(user.email ? { email: user.email } : {}),
    name: user.name,
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    location: user.location || "",
    locale: user.locale || "vi",
  };
}

export function userCookieOptions(config: Config) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/v1",
    maxAge: 7200000,
  };
}

export async function createUserSession(
  user: Pick<UserRecord, "_id" | "sessionVersion">,
  config: Config,
) {
  return new SignJWT({ role: "user", version: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user._id))
    .setIssuer("vietnam-heritage")
    .setAudience("user")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(config.JWT_SECRET));
}

function sessionResult(user: UserRecord, config: Config) {
  return createUserSession(user, config).then((token) => ({
    token,
    user: toProfile(user),
  }));
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  config: Config,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail }))
    throw new AppError(409, "Email này đã được sử dụng.");

  const user = (await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hash(password, 12),
  })) as unknown as UserRecord;
  return sessionResult(user, config);
}

export async function loginUser(
  email: string,
  password: string,
  config: Config,
) {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    active: true,
  }).select("+passwordHash");
  dummyPasswordHash ??= hash("constant-time-invalid-user-password", 12);
  const valid = await compare(
    password,
    user?.passwordHash || (await dummyPasswordHash),
  );
  if (!user || !user.passwordHash || !valid)
    throw new AppError(401, "Email hoặc mật khẩu không chính xác.");
  return sessionResult(user as unknown as UserRecord, config);
}

const resetTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function requestUserPasswordReset(email: string) {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    active: true,
    passwordHash: { $exists: true },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");

  // Keep the response indistinguishable for unknown and OAuth-only accounts.
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  user.passwordResetTokenHash = resetTokenHash(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  return token;
}

export async function resetUserPassword(token: string, password: string) {
  const user = await User.findOne({
    passwordResetTokenHash: resetTokenHash(token),
    passwordResetExpiresAt: { $gt: new Date() },
    active: true,
  }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");
  if (!user)
    throw new AppError(
      400,
      "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
    );

  user.passwordHash = await hash(password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.sessionVersion += 1;
  await user.save();
}

export async function updateUserProfile(id: string, input: unknown) {
  const changes = profileSchema.parse(input);
  const user = await User.findOneAndUpdate(
    { _id: id, active: true },
    { $set: changes },
    { new: true, runValidators: true },
  ).lean<UserRecord>();
  if (!user) throw new AppError(401, "Vui lòng đăng nhập lại.");
  return toProfile(user);
}

export async function logoutUser(id: string) {
  await User.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } });
}

const cleanText = (value: string | undefined, max: number, fallback = "") =>
  (value || fallback).trim().slice(0, max);

export async function findOrCreateOAuthUser(input: {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}) {
  const providerAccountId = cleanText(input.providerAccountId, 255);
  if (!providerAccountId)
    throw new AppError(401, "Không xác minh được tài khoản đăng nhập.");

  const existing = await OAuthAccount.findOne({
    provider: input.provider,
    providerAccountId,
  }).lean<{ userId: unknown }>();

  if (existing) {
    const user = await User.findOne({
      _id: existing.userId,
      active: true,
    }).lean<UserRecord>();
    if (!user) throw new AppError(401, "Tài khoản này không còn hoạt động.");

    return {
      user: toProfile(user),
      session: { _id: user._id, sessionVersion: user.sessionVersion },
    };
  }

  const email = cleanText(input.email?.toLowerCase(), 254);
  // Do not automatically merge identities by email. The user must first sign
  // in through the provider that is already linked to that account.
  if (email && (await User.exists({ email })))
    throw new AppError(
      409,
      "Email này đã gắn với một tài khoản khác. Hãy đăng nhập bằng phương thức đã liên kết.",
    );

  let user: UserRecord | undefined;
  try {
    user = (await User.create({
      ...(email ? { email } : {}),
      name: cleanText(input.name, 100, "Thành viên"),
      avatarUrl: cleanText(input.avatarUrl, 2048),
    })) as unknown as UserRecord;
    await OAuthAccount.create({
      userId: user._id,
      provider: input.provider,
      providerAccountId,
      providerEmail: email,
    });
  } catch (error) {
    // This document was created by this request only; remove it if linking the
    // provider failed (for example, a concurrent first login).
    if (user) await User.deleteOne({ _id: user._id });
    throw error;
  }

  return {
    user: toProfile(user),
    session: { _id: user._id, sessionVersion: user.sessionVersion },
  };
}
