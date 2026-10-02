import { compare, hash } from "bcryptjs";
import { SignJWT } from "jose";
import { z } from "zod";

import type { Config } from "../config/env.ts";
import { Admin } from "../models/index.ts";
import { AppError } from "../utils/http.ts";

let dummyHash: Promise<string> | undefined;

const accountUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.email().max(254).optional(),
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: z.string().min(12).max(200).optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    "No account changes provided",
  );

export async function login(email: string, password: string, config: Config) {
  const user = await Admin.findOne({
    email: email.toLowerCase(),
    active: true,
  }).select("+passwordHash");
  dummyHash ??= hash("constant-time-invalid-password", 12);
  const valid = await compare(
    password,
    user?.passwordHash || (await dummyHash),
  );
  if (!user || !valid)
    throw new AppError(401, "Email hoặc mật khẩu không chính xác.");

  const token = await new SignJWT({
    role: "admin",
    version: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user._id))
    .setIssuer("vietnam-heritage")
    .setAudience("admin")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(config.JWT_SECRET));

  return {
    token,
    user: { id: String(user._id), email: user.email, name: user.name },
  };
}

export const cookieOptions = (config: Config) => ({
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1",
  maxAge: 7200000,
});

export async function logout(id: string) {
  await Admin.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } });
}

export async function adminAccount(id: string) {
  const account = await Admin.findById(id).select(
    "name email role createdAt updatedAt",
  );
  if (!account) throw new AppError(401, "Vui lòng đăng nhập lại.");
  return account;
}

export async function updateAdminAccount(id: string, input: unknown) {
  const data = accountUpdateSchema.parse(input);
  const account = await Admin.findById(id).select("+passwordHash");
  if (!account || !account.active)
    throw new AppError(401, "Vui lòng đăng nhập lại.");

  const nextEmail = data.email?.trim().toLowerCase();
  const changesCredentials =
    Boolean(data.newPassword) ||
    Boolean(nextEmail && nextEmail !== account.email);

  if (changesCredentials) {
    if (!data.currentPassword)
      throw new AppError(400, "Vui lòng nhập mật khẩu hiện tại.");
    if (!(await compare(data.currentPassword, account.passwordHash)))
      throw new AppError(401, "Mật khẩu hiện tại không đúng.");
  }

  if (nextEmail && nextEmail !== account.email) {
    if (await Admin.exists({ email: nextEmail, _id: { $ne: account._id } }))
      throw new AppError(409, "Email này đã được sử dụng.");
    account.email = nextEmail;
  }

  if (data.name) account.name = data.name;
  if (data.newPassword) account.passwordHash = await hash(data.newPassword, 12);
  if (changesCredentials) account.sessionVersion += 1;
  await account.save();

  return {
    account: {
      id: String(account._id),
      name: account.name,
      email: account.email,
      role: account.role,
    },
    // A credential change invalidates all existing admin sessions, including
    // the browser that made this request.
    sessionRevoked: changesCredentials,
  };
}
