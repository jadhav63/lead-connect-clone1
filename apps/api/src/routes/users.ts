import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
const router = Router();
const bodySchema = z.object({
  name: z.string().trim().min(1).max(120), email: z.email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(['FRONT_DESK','HOUSEKEEPING','MAINTENANCE','MANAGER'])
});
router.post('/', requireAuth, requireRole('ADMIN','MANAGER'), async (req, res) => {
  const data = bodySchema.parse(req.body);
  if (data.role === 'MANAGER' && !req.auth!.roles.includes('ADMIN')) throw new HttpError(403, 'Forbidden');
  const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: {
      name: data.name, email: data.email.toLowerCase(), passwordHash
    }});
    await tx.propertyMembership.create({ data: {
      propertyId: req.auth!.propertyId, userId: user.id, role: data.role
    }});
    await tx.auditLog.create({ data: {
      propertyId: req.auth!.propertyId, actorId: req.auth!.userId,
      action: 'CREATE', entityType: 'User', entityId: user.id
    }});
    return { id: user.id, name: user.name, email: user.email, role: data.role };
  });
  res.status(201).json(result);
});
export default router;
