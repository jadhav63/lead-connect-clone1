import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { accessToken, hashToken, newRefreshToken, refreshExpiry } from '../lib/tokens.js';
const invalid = () => new HttpError(401, 'Invalid credentials');
// A valid process-local dummy hash keeps unknown-user verification on the same
// Argon2id path as real accounts without embedding a reusable password or hash.
const dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });
export async function login(email: string, password: string, propertyCode: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { memberships: { where: { isActive: true }, include: { property: true } } }
  });
  // Always perform a password verification to limit account-enumeration timing differences.
  const valid = await argon2.verify(user?.passwordHash ?? await dummyHash, password).catch(() => false);
  if (!user || !valid || !user.isActive || user.deletedAt) throw invalid();
  const membership = user.memberships.find(m => m.property.code === propertyCode);
  if (!membership) throw invalid();
  const refresh = newRefreshToken();
  await prisma.$transaction(async tx => {
    await tx.refreshToken.create({ data: {
      userId: user.id, propertyId: membership.propertyId,
      tokenHash: hashToken(refresh), expiresAt: refreshExpiry()
    }});
    await tx.auditLog.create({ data: {
      propertyId: membership.propertyId, actorId: user.id,
      action: 'LOGIN', entityType: 'User', entityId: user.id
    }});
  });
  return {
    accessToken: accessToken(user.id, membership.propertyId), refreshToken: refresh,
    user: { id: user.id, name: user.name, email: user.email, propertyId: membership.propertyId }
  };
}
export async function rotateRefresh(raw: string) {
  const hashed = hashToken(raw);
  return prisma.$transaction(async tx => {
    const existing = await tx.refreshToken.findUnique({ where: { tokenHash: hashed } });
    if (!existing) throw new HttpError(401, 'Invalid session');
    // A replay of a previously rotated token invalidates every active session for the user.
    if (existing.revokedAt) {
      await tx.refreshToken.updateMany({ where: { userId: existing.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return null;
    }
    if (existing.expiresAt <= new Date() || !existing.propertyId) throw new HttpError(401, 'Invalid session');
    const user = await tx.user.findUnique({ where: { id: existing.userId }, include: {
      memberships: { where: { propertyId: existing.propertyId, isActive: true } }
    }});
    if (!user?.isActive || user.deletedAt || !user.memberships.length) throw new HttpError(401, 'Invalid session');
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null }, data: { revokedAt: new Date() }
    });
    if (revoked.count !== 1) throw new HttpError(401, 'Invalid session');
    const refresh = newRefreshToken();
    await tx.refreshToken.create({ data: {
      userId: user.id, propertyId: existing.propertyId,
      tokenHash: hashToken(refresh), expiresAt: refreshExpiry()
    }});
    return { accessToken: accessToken(user.id, existing.propertyId), refreshToken: refresh };
  }, { isolationLevel: 'Serializable' }).then(result => {
    if (!result) throw new HttpError(401, 'Invalid session');
    return result;
  });
}
export async function revokeRefresh(raw: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null }, data: { revokedAt: new Date() }
  });
}
