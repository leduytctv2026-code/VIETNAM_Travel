import "dotenv/config";
import { z } from "zod";
import { validateMongoConnectionString } from "./database.ts";
const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().trim().min(1).optional(),
);
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  MEDIA_PROVIDER: z.enum(["local", "s3"]).default("local"),
  MEDIA_ROOT: z.string().default(".local/media"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("ap-southeast-1"),
  S3_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url().optional(),
  ),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CAPTCHA_SECRET: z.string().optional(),
  CAPTCHA_SITE_KEY: z.string().optional(),
  // A provider is enabled only when both values are set.
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  FACEBOOK_APP_ID: optionalSecret,
  FACEBOOK_APP_SECRET: optionalSecret,
});
export function readConfig(input: NodeJS.ProcessEnv = process.env) {
  const vercelProductionHost = input.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const config = schema.parse({
    ...input,
    FRONTEND_URL:
      input.FRONTEND_URL ||
      (vercelProductionHost
        ? `https://${vercelProductionHost}`
        : undefined),
    TRUST_PROXY_HOPS:
      input.VERCEL === "1" ? "1" : input.TRUST_PROXY_HOPS,
  });
  validateMongoConnectionString(config.DATABASE_URL);
  if (
    config.NODE_ENV === "production" &&
    !config.FRONTEND_URL.startsWith("https://")
  )
    throw new Error("FRONTEND_URL must use HTTPS in production");
  if (config.MEDIA_PROVIDER === "s3" && !config.S3_BUCKET)
    throw new Error("S3_BUCKET is required");
  if (Boolean(config.CAPTCHA_SECRET) !== Boolean(config.CAPTCHA_SITE_KEY))
    throw new Error(
      "CAPTCHA_SECRET and CAPTCHA_SITE_KEY must be configured together",
    );
  if (Boolean(config.GOOGLE_CLIENT_ID) !== Boolean(config.GOOGLE_CLIENT_SECRET))
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together",
    );
  if (Boolean(config.FACEBOOK_APP_ID) !== Boolean(config.FACEBOOK_APP_SECRET))
    throw new Error(
      "FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured together",
    );
  return config;
}
export type Config = ReturnType<typeof readConfig>;
