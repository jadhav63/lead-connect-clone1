import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { accessToken, verifyAccess, newRefreshToken, hashToken } from '../src/lib/tokens.js';
import { env } from '../src/config/env.js';
describe('token security', () => {
  it('scopes access tokens to a user and property and expires them in 15 minutes', () => {
    const token = accessToken('test-user', 'test-property');
    expect(verifyAccess(token)).toEqual({ userId: 'test-user', propertyId: 'test-property', sessionVersion:0 });
    const claims = jwt.decode(token) as jwt.JwtPayload;
    expect(claims.exp! - claims.iat!).toBe(900);
  });
  it('rejects expired tokens and tokens with an unexpected audience or algorithm', () => {
    const claims = { sub: 'test-user', propertyId: 'test-property' };
    for (const token of [
      jwt.sign(claims, env.JWT_ACCESS_SECRET, { issuer: 'lead-connect', audience: 'lead-connect-api', expiresIn: -1 }),
      jwt.sign(claims, env.JWT_ACCESS_SECRET, { issuer: 'lead-connect', audience: 'another-api' }),
      jwt.sign(claims, env.JWT_ACCESS_SECRET, { issuer: 'lead-connect', audience: 'lead-connect-api', algorithm: 'HS384' }),
      jwt.sign(claims, randomBytes(48), { issuer: 'lead-connect', audience: 'lead-connect-api' }),
    ]) expect(() => verifyAccess(token)).toThrow('Unauthorized');
  });
  it('rejects missing property scope', () => {
    const token = jwt.sign({ sub: 'test-user' }, env.JWT_ACCESS_SECRET, { issuer: 'lead-connect', audience: 'lead-connect-api' });
    expect(() => verifyAccess(token)).toThrow('Unauthorized');
  });
  it('generates unique 48-byte refresh tokens and deterministic non-reversible storage hashes', () => {
    const a = newRefreshToken(); const b = newRefreshToken();
    expect(Buffer.from(a, 'base64url')).toHaveLength(48);
    expect(a).not.toBe(b);
    expect(hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
