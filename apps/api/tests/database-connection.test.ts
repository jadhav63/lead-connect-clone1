import { describe, expect, it } from 'vitest';
import { databaseConfiguration, STAGING_DATABASE_HOST } from '../src/lib/database-config.js';
import { classifyDatabaseFailure, databaseFailureLog } from '../src/lib/database-diagnostics.js';

const url = `postgresql://neondb_owner:fictional%40password%252F@${STAGING_DATABASE_HOST}/leadconnect?sslmode=verify-full&channel_binding=require`;

describe('canonical PostgreSQL configuration', () => {
  it('preserves encoded credentials once and uses explicit verified TLS and channel binding', () => {
    const settings = databaseConfiguration(url, true, true);
    expect(settings.config.password).toBe('fictional@password%2F');
    expect(settings.config.ssl).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    expect(settings.config.enableChannelBinding).toBe(true);
    expect(settings.config.connectionString).toBeUndefined();
    expect(settings.config.max).toBe(5);
    expect(settings.metadata.stagingTargetVerified).toBe(true);
  });
  it('upgrades a legacy require URL to the same certificate-verified configuration', () => {
    const settings = databaseConfiguration(url.replace('verify-full', 'require'), true, true);
    expect(settings.config.ssl).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    expect(settings.metadata.legacyTlsModeNormalized).toBe(true);
  });
  it.each([
    url.replace('verify-full', 'disable'), url.replace('verify-full', 'verify-ca'),
    url + '&ssl=0', url + '&host=production.example.test', url + '&sslmode=require',
    url + '&schema=other', url.replace('leadconnect?', 'neondb?'),
    url.replace(STAGING_DATABASE_HOST, 'ep-production-pooler.example.test'),
    url.replace('channel_binding=require', 'channel_binding=disable'),
    ' ' + url, "'" + url + "'", url.replace('fictional%40password%252F', '%ZZ'),
  ])('fails closed on a malformed or unsafe staging URL without including it in errors', raw => {
    try { databaseConfiguration(raw, true, true); expect.fail('Unsafe URL accepted'); }
    catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Invalid database configuration');
      expect(JSON.stringify(error)).not.toContain('fictional');
    }
  });
  it('keeps disposable loopback database tests separate from remote TLS', () => {
    expect(databaseConfiguration('postgresql://test:test@127.0.0.1:5432/leadconnect_test', false, false).config.ssl).toBe(false);
    expect(() => databaseConfiguration('postgresql://test:test@remote.example.test/leadconnect_test', false, false)).toThrow();
  });
});

describe('safe database diagnostics', () => {
  it.each([
    ['ENOTFOUND', 'dns_resolution_failure'], ['ETIMEDOUT', 'connection_timeout'],
    ['28P01', 'authentication_failure'], ['ERR_TLS_CERT_ALTNAME_INVALID', 'tls_verification_failure'],
    ['ECONNREFUSED', 'database_unavailable'], ['3D000', 'invalid_database_name'],
    ['53300', 'pool_exhaustion'], ['P2024', 'pool_exhaustion'],
  ])('classifies %s without disclosing the driver message', (code, category) => {
    const error = Object.assign(new Error('private-user password=never-log-me ' + url), { code });
    expect(classifyDatabaseFailure(error).category).toBe(category);
    expect(JSON.parse(databaseFailureLog(error, 'readiness'))).toEqual({ event: 'database_failure', phase: 'readiness', category, code });
  });
  it('finds nested Prisma adapter errors and rejects arbitrary code/message contents', () => {
    expect(classifyDatabaseFailure({ code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '28P01' } } } })).toEqual({ category: 'authentication_failure', code: '28P01' });
    expect(databaseFailureLog({ code: url, message: 'password=never-log-me' }, 'pool')).toBe('{"event":"database_failure","phase":"pool","category":"other_database_error"}');
  });
  it('distinguishes waiting pool exhaustion from a network connection timeout', () => {
    const error = new Error('timeout exceeded when trying to connect');
    expect(classifyDatabaseFailure(error, 2).category).toBe('pool_exhaustion');
    expect(classifyDatabaseFailure(error, 0).category).toBe('connection_timeout');
  });
});
