import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared executable Node helper.
import { assertRenderTestTarget, renderTestClientConfig } from '../scripts/render-test-target.mjs';
function config() {
  const password = randomBytes(24).toString('hex');
  const direct = new URL('postgresql://test-role@render-test.example.neon.tech/leadconnect?sslmode=verify-full');
  direct.password = password;
  const pooled = new URL(direct); pooled.hostname = 'render-test-pooler.example.neon.tech';
  return { DATABASE_URL: pooled.href, DIRECT_URL: direct.href, RENDER_TEST_DIRECT_HOST: direct.hostname, RENDER_TEST_POOLED_HOST: pooled.hostname };
}
describe('cloud test migration target guard', () => {
  it('accepts only the independently verified test endpoint pair', () => {
    expect(() => assertRenderTestTarget(config())).not.toThrow();
  });
  it.each(['hostname', 'database', 'tls', 'override', 'schema', 'missing', 'duplicate'])('refuses unsafe %s before opening a database connection', change => {
    const env = config(); const url = new URL(env.DIRECT_URL);
    if (change === 'hostname') url.hostname = 'production.example.test';
    if (change === 'database') url.pathname = '/other';
    if (change === 'tls') url.searchParams.set('sslmode', 'disable');
    if (change === 'override') url.searchParams.set('host', 'production.example.test');
    if (change === 'schema') url.searchParams.set('schema', 'other');
    if (change === 'duplicate') url.searchParams.append('sslmode', 'disable');
    env.DIRECT_URL = change === 'missing' ? '' : url.href;
    expect(() => assertRenderTestTarget(env)).toThrow();
  });
  it('also refuses a production application URL when the migration URL is safe', () => {
    const env = config(); const url = new URL(env.DATABASE_URL); url.hostname = 'production.example.test'; env.DATABASE_URL = url.href;
    expect(() => assertRenderTestTarget(env)).toThrow();
  });
  it('requires certificate and hostname verification, not encryption alone', () => {
    const env = config();
    const url = new URL(env.DIRECT_URL);
    url.searchParams.set('sslmode', 'require');
    env.DIRECT_URL = url.href;
    expect(() => assertRenderTestTarget(env)).toThrow('TLS setting');
  });
  it('constructs a verified TLS client config with no connection-string override surface', () => {
    const config = renderTestClientConfig(configForClient());
    expect(config.host).toBe('render-test.example.neon.tech');
    expect(config.database).toBe('leadconnect');
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.enableChannelBinding).toBe(true);
  });
});

function configForClient() {
  return 'postgresql://test-role:fake-test-password@render-test.example.neon.tech/leadconnect?sslmode=verify-full';
}
