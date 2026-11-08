// Public endpoint identity independently checked in the Neon render-test console.
// These are endpoint names, not credentials. No production endpoint is accepted.
export const RENDER_TEST_DIRECT_HOST = "ep-old-truth-aror3gey.c-4.us-west-2.aws.neon.tech";
export function assertRenderTestTarget(environment) {
  const hosts = {
    DATABASE_URL: "ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech",
    DIRECT_URL: RENDER_TEST_DIRECT_HOST,
  };
  for (const [key, hostname] of Object.entries(hosts)) {
    let url;
    try {
      url = new URL(environment[key] ?? "");
    } catch {
      throw new Error(`${key}: private render-test connection required`);
    }
    const keys = [...url.searchParams.keys()];
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== hostname ||
      url.pathname !== "/leadconnect" ||
      (url.port && url.port !== "5432") ||
      url.hash ||
      !url.username ||
      !url.password ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      keys.some((k) => !["sslmode", "channel_binding", "schema"].includes(k)) ||
      keys.some((k) => url.searchParams.getAll(k).length !== 1) ||
      (url.searchParams.has("schema") &&
        url.searchParams.get("schema") !== "public")
    ) {
      throw new Error(
        `${key}: refusing an unverified branch, database, TLS setting, or connection override`,
      );
    }
  }
}

// Build a minimal pg config from the already-validated direct URL. Avoid letting
// pg-connection-string URL options override TLS settings: certificate validation
// is explicit here and the verified hostname is also used for TLS SNI checks.
export function renderTestClientConfig(rawUrl) {
  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: true,
    connectionTimeoutMillis: 15000,
  };
}
