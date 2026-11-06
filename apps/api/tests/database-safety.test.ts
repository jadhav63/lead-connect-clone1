import { describe, expect, it } from 'vitest';
// @ts-expect-error Shared Node safety helper.
import { assertTestDatabase } from '../scripts/test-database.mjs';
describe('test database safety', () => {
  it('accepts only a named disposable database on loopback', () => {
    expect(() => assertTestDatabase('postgresql://localhost:55432/leadconnect_test')).not.toThrow();
  });
  it.each([
    undefined,
    'postgresql://localhost/leadconnect',
    'postgresql://db.example.test/leadconnect_test',
    'postgresql://localhost/production?application_name=leadconnect_test',
    'postgresql://localhost/leadconnect_test?host=db.example.test',
    'postgresql://localhost/leadconnect_test?schema=production',
    'postgresql://localhost.evil.test/leadconnect_test',
  ])('rejects unsafe or misleading URLs (%s)', raw => {
    expect(() => assertTestDatabase(raw)).toThrow();
  });
});
