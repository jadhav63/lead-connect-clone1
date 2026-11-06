import { createHash, randomBytes } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './errors.js';
export function accessToken(userId: string, propertyId: string) {
  return jwt.sign({ propertyId }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256', issuer: 'lead-connect', audience: 'lead-connect-api',
    subject: userId, expiresIn: '15m'
  });
}
export function verifyAccess(token: string) {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'], issuer: 'lead-connect', audience: 'lead-connect-api'
    }) as JwtPayload;
    if (typeof decoded.sub !== 'string' || typeof decoded.propertyId !== 'string') throw new Error('Invalid claims');
    return { userId: decoded.sub, propertyId: decoded.propertyId };
  } catch { throw new HttpError(401, 'Unauthorized'); }
}
export const newRefreshToken = () => randomBytes(48).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const refreshExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86400000);
