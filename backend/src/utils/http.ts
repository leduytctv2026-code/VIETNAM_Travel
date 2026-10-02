import type { Response } from "express";
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function send(
  res: Response,
  data: unknown,
  status = 200,
  pagination?: unknown,
  message = "",
) {
  return res.status(status).json({
    success: true,
    data,
    message,
    ...(pagination ? { pagination } : {}),
  });
}
export function toJSON<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export type Locale = "vi" | "en";
export function language(value: unknown): Locale {
  return value === "en" ? "en" : "vi";
}
export function translate(value: unknown, lang: Locale): unknown {
  if (Array.isArray(value)) return value.map((v) => translate(v, lang));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("vi" in record || "en" in record)
      return (lang === "en" && record.en) || record.vi || record.en || "";
    return Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, translate(v, lang)]),
    );
  }
  return value;
}
export function pagination(query: Record<string, unknown>) {
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(query.page) || 1)),
  );
  const limit = Math.max(
    1,
    Math.min(100, Math.floor(Number(query.limit) || 12)),
  );
  return { page, limit, skip: (page - 1) * limit };
}
export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
