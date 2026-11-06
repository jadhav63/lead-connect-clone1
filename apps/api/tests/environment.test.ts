import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { environmentSchema } from '../src/config/env.js';
describe('production configuration', () => {
  const config = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db.example.test/placeholder?sslmode=require',
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    CORS_ORIGIN: 'https://app.example.test',
  };
  it('requires encrypted database transport and an HTTPS browser origin', () => {
    expect(environmentSchema.safeParse(config).success).toBe(true);
    expect(environmentSchema.safeParse({ ...config, DATABASE_URL: 'postgresql://db.example.test/placeholder' }).success).toBe(false);
    expect(environmentSchema.safeParse({ ...config, CORS_ORIGIN: 'http://app.example.test' }).success).toBe(false);
  });
  it('rejects short signing secrets', () => {
    expect(environmentSchema.safeParse({ ...config, JWT_ACCESS_SECRET: randomBytes(8).toString('hex') }).success).toBe(false);
  });
});
