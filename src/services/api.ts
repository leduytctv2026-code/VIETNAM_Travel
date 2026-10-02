import type { Envelope, Locale } from "../../shared/domain";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  lang: Locale = "vi",
  serverOrigin?: string,
): Promise<Envelope<T>> {
  const base =
    typeof window === "undefined"
      ? `${(serverOrigin || process.env.API_INTERNAL_URL || "http://localhost:5000").replace(/\/+$/, "")}/api/v1`
      : "/api/v1";
  const separator = path.includes("?") ? "&" : "?";
  let response: Response;
  try {
    response = await fetch(`${base}${path}${separator}lang=${lang}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      503,
      lang === "vi"
        ? "Không thể kết nối dịch vụ. Vui lòng thử lại."
        : "Unable to connect. Please try again.",
    );
  }
  const result = (await response.json()) as Envelope<T>;
  if (!response.ok || !result.success)
    throw new ApiError(response.status, result.message || "Request failed");
  return result;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  lang: Locale = "vi",
  serverOrigin?: string,
) {
  return (await request<T>(path, options, lang, serverOrigin)).data;
}
