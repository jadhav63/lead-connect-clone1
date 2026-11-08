import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { environmentSchema } from '../src/config/env.js';
import { proxyTrustSetting } from '../src/config/proxy.js';
describe('production configuration', () => {
  const config = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db.example.test/placeholder?sslmode=verify-full',
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    CORS_ORIGIN: 'https://app.example.test',
  };
  it('requires verified database TLS and an HTTPS browser origin', () => {
    expect(environmentSchema.safeParse(config).success).toBe(true);
    expect(environmentSchema.safeParse({ ...config, DATABASE_URL: 'postgresql://db.example.test/placeholder' }).success).toBe(false);
    // Runtime normalizes legacy require to explicit verified TLS, never weaker driver defaults.
    expect(environmentSchema.safeParse({ ...config, DATABASE_URL: 'postgresql://db.example.test/placeholder?sslmode=require' }).success).toBe(true);
    expect(environmentSchema.safeParse({ ...config, DATABASE_URL: 'postgresql://db.example.test/placeholder?sslmode=verify-ca' }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...config, CORS_ORIGIN: 'http://app.example.test' }).success).toBe(false);
  });
  it('rejects short signing secrets', () => {
    expect(environmentSchema.safeParse({ ...config, JWT_ACCESS_SECRET: randomBytes(8).toString('hex') }).success).toBe(false);
  });
  it('requires an independently configured production target and first-party session delivery', () => {
    expect(environmentSchema.safeParse({ ...config, APP_ENV: 'production' }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...config, APP_ENV: 'production', WEB_DIST_PATH: '../web/dist', EXPECTED_DATABASE_HOST: 'confirmed.example', EXPECTED_DATABASE_NAME: 'leadconnect_production', EXPECTED_DATABASE_USER: 'leadconnect_app' }).success).toBe(true);
    expect(environmentSchema.safeParse({ ...config, NODE_ENV: 'test', AUTH_COOKIE_SAME_SITE: 'none' }).success).toBe(false);
  });
});

describe('reverse proxy trust', () => {
  it('trusts only the immediate Render proxy in production', () => {
    expect(proxyTrustSetting('production')).toBe(1);
  });
  it('does not trust forwarded headers outside production', () => {
    expect(proxyTrustSetting('test')).toBe(false);
    expect(proxyTrustSetting('development')).toBe(false);
  });
});
