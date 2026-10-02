import dns from "node:dns";
import mongoose from "mongoose";

const mongoConnectionScheme = /^mongodb(?:\+srv)?:\/\//i;
const embeddedEnvironmentAssignment =
  /^(?:DATABASE_URL|MONGODB_URI|MONGO_URI)=/i;

export function validateMongoConnectionString(value: string) {
  const uri = value.trim();

  if (!uri) throw new Error("DATABASE_URL is required.");
  if (uri !== value)
    throw new Error(
      "DATABASE_URL must not contain leading or trailing whitespace.",
    );
  if (embeddedEnvironmentAssignment.test(uri))
    throw new Error(
      "DATABASE_URL must contain only the MongoDB URI, not another environment-variable assignment.",
    );
  if (!mongoConnectionScheme.test(uri))
    throw new Error(
      "DATABASE_URL must start with mongodb:// or mongodb+srv://.",
    );
  if (uri.includes("<") || uri.includes(">"))
    throw new Error(
      "DATABASE_URL must use the actual URL-encoded credentials, without < or > placeholders.",
    );

  return uri;
}

export async function connectDatabase(uri: string) {
  const connectionString = validateMongoConnectionString(uri);
  const isAtlasSrv = connectionString.startsWith("mongodb+srv://");

  // Some Windows/Node environments resolve the Atlas SRV record to IPv6
  // first. That path can fail during the TLS handshake even when the Atlas
  // IP access list is correct. Prefer IPv4 for Atlas while leaving local
  // mongodb:// connections usable for the isolated development fallback.
  const options = {
    family: 4 as const,
    ...(isAtlasSrv ? { tls: true } : {}),
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoIndex: false,
  };
  let lastError: unknown;
  const attempts = isAtlasSrv ? 3 : 1;
  const originalDnsServers = dns.getServers();
  let dnsFallbackApplied = false;

  // Resolve Atlas SRV records through a known-good resolver before the first
  // connection attempt. Windows' configured resolver can intermittently
  // time out on `_mongodb._tcp` even though the cluster and IP allow-list are
  // healthy. Override this with MONGO_DNS_SERVERS when a network requires a
  // different resolver.
  if (isAtlasSrv) {
    const configuredServers = (
      process.env.MONGO_DNS_SERVERS || "1.1.1.1,8.8.8.8"
    )
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean);
    if (configuredServers.length) {
      dns.setServers(configuredServers);
      dnsFallbackApplied = true;
    }
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(connectionString, options);
      if (dnsFallbackApplied) dns.setServers(originalDnsServers);
      return;
    } catch (error) {
      lastError = error;
      await mongoose.disconnect().catch(() => undefined);
      if (attempt < attempts)
        await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  if (dnsFallbackApplied) dns.setServers(originalDnsServers);
  throw lastError;
}
