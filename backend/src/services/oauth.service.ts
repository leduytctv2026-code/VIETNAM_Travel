import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";

import type { Config } from "../config/env.ts";
import { AppError } from "../utils/http.ts";
import {
  createUserSession,
  findOrCreateOAuthUser,
  type OAuthProvider,
  userCookieOptions,
} from "./user-auth.service.ts";

type OAuthState = {
  provider: OAuthProvider;
  state: string;
  verifier: string;
  nonce?: string;
};

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const cleanUrl = (url: string) => url.replace(/\/$/, "");
const callbackUrl = (config: Config, provider: OAuthProvider) =>
  `${cleanUrl(config.FRONTEND_URL)}/api/v1/auth/${provider}/callback`;
const stateCookieName = (provider: OAuthProvider) =>
  `heritage_oauth_${provider}_state`;

function providerEnabled(provider: OAuthProvider, config: Config) {
  return provider === "google"
    ? Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET)
    : Boolean(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET);
}

export function oauthProviders(config: Config) {
  return {
    google: providerEnabled("google", config),
    facebook: providerEnabled("facebook", config),
  };
}

function requireProvider(provider: OAuthProvider, config: Config) {
  if (!providerEnabled(provider, config))
    throw new AppError(
      503,
      provider === "google"
        ? "Đăng nhập Google chưa được cấu hình."
        : "Đăng nhập Facebook chưa được cấu hình.",
    );
}

function oauthStateCookieOptions(config: Config, provider: OAuthProvider) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    // Lax is intentional: a top-level redirect from the identity provider
    // must send this CSRF-protection cookie back to the callback endpoint.
    sameSite: "lax" as const,
    path: `/api/v1/auth/${provider}`,
    maxAge: 10 * 60 * 1000,
  };
}

function clearStateCookie(
  res: Response,
  config: Config,
  provider: OAuthProvider,
) {
  const { maxAge: _maxAge, ...options } = oauthStateCookieOptions(
    config,
    provider,
  );
  res.clearCookie(stateCookieName(provider), options);
}

async function signState(state: OAuthState, config: Config) {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("vietnam-heritage")
    .setAudience("oauth-state")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(config.JWT_SECRET));
}

async function readState(
  req: Request,
  config: Config,
  provider: OAuthProvider,
) {
  const token = req.cookies?.[stateCookieName(provider)];
  if (typeof token !== "string")
    throw new AppError(401, "Phiên đăng nhập đã hết hạn.");

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(config.JWT_SECRET),
    {
      issuer: "vietnam-heritage",
      audience: "oauth-state",
      algorithms: ["HS256"],
    },
  );

  if (
    payload.provider !== provider ||
    typeof payload.state !== "string" ||
    typeof payload.verifier !== "string" ||
    (provider === "google" && typeof payload.nonce !== "string")
  )
    throw new AppError(401, "Phiên đăng nhập không hợp lệ.");

  return payload as OAuthState;
}

const randomValue = () => randomBytes(32).toString("base64url");
const codeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

export async function beginOAuth(
  provider: OAuthProvider,
  config: Config,
  res: Response,
) {
  requireProvider(provider, config);
  const state = randomValue();
  const verifier = randomValue();
  const nonce = provider === "google" ? randomValue() : undefined;

  res.cookie(
    stateCookieName(provider),
    await signState(
      { provider, state, verifier, ...(nonce ? { nonce } : {}) },
      config,
    ),
    oauthStateCookieOptions(config, provider),
  );

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: callbackUrl(config, provider),
    state,
  });

  if (provider === "google") {
    params.set("client_id", config.GOOGLE_CLIENT_ID!);
    params.set("scope", "openid email profile");
    params.set("nonce", nonce!);
    params.set("code_challenge", codeChallenge(verifier));
    params.set("code_challenge_method", "S256");
    params.set("prompt", "select_account");
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  params.set("client_id", config.FACEBOOK_APP_ID!);
  params.set("scope", "public_profile,email");
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

function textClaim(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function googleProfile(code: string, state: OAuthState, config: Config) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(config, "google"),
      code_verifier: state.verifier,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });

  const token = (await response.json().catch(() => null)) as {
    id_token?: unknown;
  } | null;
  if (!response.ok || typeof token?.id_token !== "string")
    throw new AppError(401, "Không thể xác minh đăng nhập Google.");

  const { payload } = await jwtVerify(token.id_token, googleKeys, {
    audience: config.GOOGLE_CLIENT_ID!,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
  });
  if (payload.nonce !== state.nonce || typeof payload.sub !== "string")
    throw new AppError(401, "Xác minh đăng nhập Google thất bại.");

  const email =
    payload.email_verified === true ? textClaim(payload.email, 254) : "";
  return {
    provider: "google" as const,
    providerAccountId: payload.sub,
    ...(email ? { email } : {}),
    name: textClaim(payload.name, 100),
    avatarUrl: textClaim(payload.picture, 2048),
  };
}

async function facebookProfile(code: string, config: Config) {
  const tokenResponse = await fetch(
    "https://graph.facebook.com/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.FACEBOOK_APP_ID!,
        client_secret: config.FACEBOOK_APP_SECRET!,
        redirect_uri: callbackUrl(config, "facebook"),
        code,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  const token = (await tokenResponse.json().catch(() => null)) as {
    access_token?: unknown;
  } | null;
  if (!tokenResponse.ok || typeof token?.access_token !== "string")
    throw new AppError(401, "Không thể xác minh đăng nhập Facebook.");

  const profileResponse = await fetch(
    `https://graph.facebook.com/me?${new URLSearchParams({
      fields: "id,name,email,picture.type(large)",
    })}`,
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  const profile = (await profileResponse.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    picture?: { data?: { url?: unknown } };
  } | null;
  if (!profileResponse.ok || typeof profile?.id !== "string")
    throw new AppError(401, "Không thể đọc hồ sơ Facebook.");

  const email = textClaim(profile.email, 254);
  return {
    provider: "facebook" as const,
    providerAccountId: profile.id,
    ...(email ? { email } : {}),
    name: textClaim(profile.name, 100),
    avatarUrl: textClaim(profile.picture?.data?.url, 2048),
  };
}

export async function finishOAuth(
  provider: OAuthProvider,
  req: Request,
  res: Response,
  config: Config,
) {
  requireProvider(provider, config);

  try {
    const state = await readState(req, config, provider);
    const queryState = req.query.state;
    const code = req.query.code;
    if (queryState !== state.state || typeof code !== "string" || !code)
      throw new AppError(401, "Phản hồi đăng nhập không hợp lệ.");

    const profile =
      provider === "google"
        ? await googleProfile(code, state, config)
        : await facebookProfile(code, config);
    const result = await findOrCreateOAuthUser(profile);

    return {
      user: result.user,
      token: await createUserSession(result.session, config),
    };
  } finally {
    clearStateCookie(res, config, provider);
  }
}

export const oauthSuccessUrl = (config: Config) =>
  `${cleanUrl(config.FRONTEND_URL)}/profile`;
export const oauthFailureUrl = (config: Config) =>
  `${cleanUrl(config.FRONTEND_URL)}/profile?auth=failed`;

export { userCookieOptions };
