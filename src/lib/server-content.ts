import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { api, ApiError, request } from "@/services/api";
import type { Content, Locale } from "../../shared/domain";
import { text, imageOf } from "./content";
import type { Metadata } from "next";

async function serverApiContext() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol || (host?.startsWith("localhost") ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : "";
  const vercelHost =
    process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallbackOrigin = vercelHost
    ? `https://${vercelHost}`
    : process.env.FRONTEND_URL || "http://localhost:3000";
  const directApiOrigin =
    process.env.VERCEL === "1" ? "" : process.env.API_INTERNAL_URL;

  return {
    origin: directApiOrigin || requestOrigin || fallbackOrigin,
    cookie: requestHeaders.get("cookie") || "",
  };
}

function forwardedOptions(options: RequestInit, cookie: string): RequestInit {
  if (!cookie) return options;
  const forwardedHeaders = new Headers(options.headers);
  if (!forwardedHeaders.has("cookie")) forwardedHeaders.set("cookie", cookie);
  return { ...options, headers: forwardedHeaders };
}

export async function serverOrigin() {
  return (await serverApiContext()).origin;
}

export async function serverRequest<T>(
  path: string,
  options: RequestInit = {},
  lang: Locale = "vi",
) {
  const context = await serverApiContext();
  return request<T>(
    path,
    forwardedOptions(options, context.cookie),
    lang,
    context.origin,
  );
}

export async function serverApi<T>(
  path: string,
  options: RequestInit = {},
  lang: Locale = "vi",
) {
  const context = await serverApiContext();
  return api<T>(
    path,
    forwardedOptions(options, context.cookie),
    lang,
    context.origin,
  );
}

export async function getContent<T>(path: string): Promise<T> {
  const locale =
    (await cookies()).get("atlas_locale")?.value === "en" ? "en" : "vi";
  try {
    return await serverApi<T>(path, {}, locale);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
export function contentMetadata(item: Content, path: string): Metadata {
  const title = text(item.seo?.title) || text(item.name);
  const description =
    text(item.seo?.description) ||
    text(item.shortDescription || item.description || item.overview);
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: item.isSample ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: path, images: [imageOf(item)] },
  };
}
export function structuredData(item: Content, path: string, type = "Place") {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base =
    process.env.FRONTEND_URL ||
    (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: text(item.name),
    description: text(
      item.shortDescription || item.description || item.overview,
    ),
    url: base + path,
    ...(item.location
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: item.location.coordinates[1],
            longitude: item.location.coordinates[0],
          },
        }
      : {}),
  };
}
