import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';
import { changePassword, login, revokeRefresh, rotateRefresh } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/db.js';
import { redeemAccessGrant } from '../services/employee-access.js';
const router = Router();
// CORS alone does not reject state-changing requests from hostile browser origins.
router.use((req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('Origin');
    if ((origin && origin !== env.CORS_ORIGIN)
      || (!origin && req.get('Sec-Fetch-Site') === 'cross-site')) {
      return next(new HttpError(403, 'Untrusted request origin'));
    }
  }
  next();
});
const loginIpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
const loginAccountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(req.ip ?? '') + ':' + createHash('sha256').update(JSON.stringify([
    typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '',
    typeof req.body?.propertyCode === 'string' ? req.body.propertyCode : '',
  ])).digest('hex'),
});
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false });
const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128), propertyCode: z.string().min(1).max(64) });
const refreshValue = z.string().min(32).max(512);
const refreshBody = z.object({ refreshToken: refreshValue.optional() });
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: env.AUTH_COOKIE_SAME_SITE, path: '/api/auth', maxAge: env.REFRESH_TOKEN_DAYS * 86400000 };
function tokenFromRequest(req: import('express').Request) {
  const body = refreshBody.parse(req.body ?? {});
  const token = body.refreshToken ?? req.cookies?.lead_refresh;
  if (!token) throw new HttpError(401, 'Invalid session');
  return refreshValue.parse(token);
}
router.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  const input = credentials.parse(req.body);
  const result = await login(input.email, input.password, input.propertyCode);
  res.cookie('lead_refresh', result.refreshToken, cookieOptions);
  // For native clients only: set X-Client-Platform: mobile and store refreshToken in OS secure storage.
  const mobile = req.header('X-Client-Platform') === 'mobile';
  res.json({ accessToken: result.accessToken, user: result.user, ...(mobile ? { refreshToken: result.refreshToken } : {}) });
});
router.post('/refresh', refreshLimiter, async (req, res) => {
  const result = await rotateRefresh(tokenFromRequest(req));
  res.cookie('lead_refresh', result.refreshToken, cookieOptions);
  const mobile = req.header('X-Client-Platform') === 'mobile';
  res.json({ accessToken: result.accessToken, ...(mobile ? { refreshToken: result.refreshToken } : {}) });
});
router.post('/logout', async (req, res) => {
  const token = tokenFromRequest(req);
  await revokeRefresh(token);
  res.clearCookie('lead_refresh', { ...cookieOptions, maxAge: undefined });
  res.status(204).send();
});
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
router.post('/password', requireAuth, passwordLimiter, async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).strict().parse(req.body);
  await changePassword(req.auth!.userId, req.auth!.propertyId, input.currentPassword, input.newPassword);
  res.clearCookie('lead_refresh', { ...cookieOptions, maxAge: undefined });
  res.status(204).send();
});
router.post('/redeem-access', passwordLimiter, async(req,res)=>{
  const input=z.object({code:z.string().min(32).max(512),password:z.string().min(12).max(128)}).strict().parse(req.body);
  await redeemAccessGrant(input.code,input.password);
  res.clearCookie('lead_refresh',{...cookieOptions,maxAge:undefined});
  res.status(204).send();
});
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId }, select: { id: true, name: true, email: true }
  });
  res.json({ user, propertyId: req.auth!.propertyId, roles: req.auth!.roles });
});
export default router;
