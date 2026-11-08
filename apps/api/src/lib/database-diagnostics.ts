import { DatabaseConfigurationError } from './database-config.js';

export type DatabaseFailureCategory = 'dns_resolution_failure' | 'connection_timeout'
  | 'authentication_failure' | 'tls_verification_failure' | 'database_unavailable'
  | 'invalid_database_name' | 'pool_exhaustion' | 'invalid_configuration'
  | 'target_mismatch' | 'schema_mismatch' | 'other_database_error';

const codes: Record<string, DatabaseFailureCategory> = {
  INVALID_URL_FORMAT: 'invalid_configuration', UNSUPPORTED_URL_PARAMETER: 'invalid_configuration',
  INVALID_TLS_MODE: 'invalid_configuration', INVALID_CHANNEL_BINDING: 'invalid_configuration',
  INVALID_SCHEMA: 'invalid_configuration', INVALID_URL_ENCODING: 'invalid_configuration',
  STAGING_TARGET_MISMATCH: 'target_mismatch',
  ENOTFOUND: 'dns_resolution_failure', EAI_AGAIN: 'dns_resolution_failure',
  ETIMEDOUT: 'connection_timeout', P1002: 'connection_timeout', P1008: 'connection_timeout',
  '28P01': 'authentication_failure', '28000': 'authentication_failure', P1000: 'authentication_failure',
  ERR_TLS_CERT_ALTNAME_INVALID: 'tls_verification_failure', CERT_HAS_EXPIRED: 'tls_verification_failure',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'tls_verification_failure', SELF_SIGNED_CERT_IN_CHAIN: 'tls_verification_failure',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'tls_verification_failure', UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'tls_verification_failure',
  TLS_NOT_AUTHORIZED: 'tls_verification_failure', P1011: 'tls_verification_failure',
  ECONNREFUSED: 'database_unavailable', ECONNRESET: 'database_unavailable', EPIPE: 'database_unavailable',
  '57P01': 'database_unavailable', '57P02': 'database_unavailable', '57P03': 'database_unavailable', P1001: 'database_unavailable',
  '3D000': 'invalid_database_name', P1003: 'invalid_database_name',
  '53300': 'pool_exhaustion', P2024: 'pool_exhaustion', P2037: 'pool_exhaustion',
  DATABASE_TARGET_MISMATCH: 'target_mismatch', DATABASE_SCHEMA_MISMATCH: 'schema_mismatch',
};
const kinds: Record<string, DatabaseFailureCategory> = {
  AuthenticationFailed: 'authentication_failure', TlsConnectionError: 'tls_verification_failure',
  DatabaseDoesNotExist: 'invalid_database_name', TooManyConnections: 'pool_exhaustion',
  SocketTimeout: 'connection_timeout', DatabaseNotReachable: 'database_unavailable', ConnectionClosed: 'database_unavailable',
};

/** Return only allowlisted labels. Never return messages, hosts, SQL or driver metadata. */
export function classifyDatabaseFailure(error: unknown, waitingCount = 0): { category: DatabaseFailureCategory; code?: string } {
  if (error instanceof DatabaseConfigurationError) return codes[error.reason]
    ? { category: codes[error.reason], code: error.reason } : { category: 'invalid_configuration' };
  const seen = new Set<unknown>();
  const values: Record<string, unknown>[] = [];
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 7) return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    values.push(record);
    for (const key of ['cause', 'meta', 'driverAdapterError', 'originalError', 'error']) visit(record[key], depth + 1);
    if (Array.isArray(record.errors)) record.errors.slice(0, 10).forEach(item => visit(item, depth + 1));
  }
  visit(error);
  // Prefer concrete nested driver codes over broad Prisma connection errors.
  for (const value of [...values].reverse()) {
    for (const field of ['originalCode', 'code']) {
      const code = value[field];
      if (typeof code === 'string' && codes[code]) return { category: codes[code], code };
    }
  }
  for (const value of values) {
    if (typeof value.kind === 'string' && kinds[value.kind]) return { category: kinds[value.kind] };
    const message = typeof value.message === 'string' ? value.message : '';
    if (/timeout exceeded when trying to connect|connection timeout|connection terminated due to connection timeout/i.test(message))
      return { category: waitingCount > 0 ? 'pool_exhaustion' : 'connection_timeout' };
    if (/server does not support ssl|error establishing an ssl connection|certificate|channel binding|SASL.*mechanism/i.test(message))
      return { category: 'tls_verification_failure' };
  }
  return { category: 'other_database_error' };
}

export function databaseFailureLog(error: unknown, phase: 'readiness' | 'pool' | 'connection', waitingCount = 0) {
  return JSON.stringify({ event: 'database_failure', phase, ...classifyDatabaseFailure(error, waitingCount) });
}
