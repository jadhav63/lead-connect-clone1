import type { PoolConfig } from 'pg';

export const STAGING_DATABASE_HOST = 'ep-old-truth-aror3gey-pooler.c-4.us-west-2.aws.neon.tech';

export class DatabaseConfigurationError extends Error {
  constructor(readonly reason: string) {
    super('Invalid database configuration');
    this.name = 'DatabaseConfigurationError';
  }
}

/** Parse once; never pass URL parameters back to pg where they can override TLS. */
export function databaseConfiguration(raw: string, production: boolean, staging: boolean) {
  const refuse = (reason: string): never => { throw new DatabaseConfigurationError(reason); };
  if (raw !== raw.trim() || /[\s"'<>]/.test(raw)) refuse('INVALID_URL_FORMAT');
  let url: URL;
  try { url = new URL(raw); } catch { return refuse('INVALID_URL_FORMAT'); }
  if (url.protocol !== 'postgresql:' || url.hash || !url.hostname || !url.username || !url.password)
    refuse('INVALID_URL_FORMAT');
  const allowed = new Set(['sslmode', 'schema', 'channel_binding']);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1)
      refuse('UNSUPPORTED_URL_PARAMETER');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const tlsMode = url.searchParams.get('sslmode');
  const tls = production || !local || tlsMode === 'verify-full' || tlsMode === 'require';
  // Legacy require is upgraded to explicit certificate + hostname validation.
  // It is never forwarded to pg-connection-string, whose mode semantics vary.
  if (tls && !['verify-full', 'require'].includes(tlsMode ?? '')) refuse('INVALID_TLS_MODE');
  if (!tls && tlsMode && tlsMode !== 'disable') refuse('INVALID_TLS_MODE');
  const binding = url.searchParams.get('channel_binding');
  if (binding && binding !== 'require') refuse('INVALID_CHANNEL_BINDING');
  if (binding && !tls) refuse('INVALID_CHANNEL_BINDING');
  if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') refuse('INVALID_SCHEMA');
  let user: string, password: string, database: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { return refuse('INVALID_URL_ENCODING'); }
  if (!database || database.includes('/') || !password) refuse('INVALID_URL_FORMAT');
  const stagingTargetVerified = url.hostname === STAGING_DATABASE_HOST
    && database === 'leadconnect' && user === 'neondb_owner' && (!url.port || url.port === '5432');
  if (staging && !stagingTargetVerified) refuse('STAGING_TARGET_MISMATCH');
  const config: PoolConfig = {
    host: url.hostname, port: Number(url.port || 5432), user, password, database,
    ssl: tls ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false,
    enableChannelBinding: tls,
    max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 30_000,
    query_timeout: 15_000, keepAlive: true,
    application_name: 'lead-connect-api',
  };
  return {
    config,
    schema: 'public',
    metadata: { tls: tls ? 'verify-full' : 'local-only', channelBindingEnabled: tls,
      legacyTlsModeNormalized: tlsMode === 'require', stagingTargetVerified, poolMax: 5 },
  };
}
