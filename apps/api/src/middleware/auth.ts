import type { RequestHandler } from 'express';
import { prisma } from '../lib/db.js';
import { verifyAccess } from '../lib/tokens.js';
import { HttpError } from '../lib/errors.js';
import type { UserRole } from '../generated/prisma/enums.js';
declare global {
  namespace Express {
    interface Request { auth?: { userId: string; propertyId: string; roles: UserRole[] } }
  }
}
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const match = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new HttpError(401, 'Unauthorized');
    const claims = verifyAccess(match[1]);
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: { isActive: true, deletedAt: true, memberships: {
        where: { propertyId: claims.propertyId, isActive: true }, select: { role: true }
      }}
    });
    if (!user?.isActive || user.deletedAt || !user.memberships.length) throw new HttpError(401, 'Unauthorized');
    req.auth = { ...claims, roles: user.memberships.map(m => m.role) };
    next();
  } catch (error) { next(error); }
};
export const requireRole = (...roles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.auth) return next(new HttpError(401, 'Unauthorized'));
  if (!req.auth.roles.some(role => roles.includes(role))) return next(new HttpError(403, 'Forbidden'));
  next();
};
