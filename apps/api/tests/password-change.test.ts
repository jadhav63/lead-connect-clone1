import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { prisma } from '../src/lib/db.js';
import { app } from '../src/app.js';
import { login, rotateRefresh } from '../src/services/auth.js';
const password = randomBytes(24).toString('hex');
const replacement = randomBytes(24).toString('hex');
let propertyId = '', userId = '', token = '', refresh = '', code = '';
beforeAll(async () => {
  code = 'pw-' + randomBytes(8).toString('hex');
  const p = await prisma.property.create({ data: { name: 'Disposable password test', code } }); propertyId = p.id;
  const u = await prisma.user.create({ data: { name: 'Disposable employee', email: `${code}@example.test`, passwordHash: await argon2.hash(password), memberships: { create: { propertyId, role: 'HOUSEKEEPING' } } } }); userId = u.id;
  const session = await login(u.email, password, code); token = session.accessToken; refresh = session.refreshToken;
});
afterAll(async () => {
  if (propertyId) {
    await prisma.auditLog.deleteMany({ where: { propertyId } }); await prisma.refreshToken.deleteMany({ where: { propertyId } });
    await prisma.propertyMembership.deleteMany({ where: { propertyId } }); await prisma.user.deleteMany({ where: { id: userId } }); await prisma.property.delete({ where: { id: propertyId } });
  }
  await prisma.$disconnect();
});
it('requires a session and the correct current password; refuses extra target identities', async () => {
  expect((await request(app).post('/api/auth/password').send({})).status).toBe(401);
  expect((await request(app).post('/api/auth/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'wrong', newPassword: replacement })).status).toBe(401);
  expect((await request(app).post('/api/auth/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: password, newPassword: replacement, userId: 'other' })).status).toBe(400);
});
it('changes only the authenticated account, revokes refresh sessions, and keeps secrets out of audit data', async () => {
  const response = await request(app).post('/api/auth/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: password, newPassword: replacement });
  expect(response.status).toBe(204);
  expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  await expect(rotateRefresh(refresh)).rejects.toThrow('Invalid session');
  await expect(login(`${code}@example.test`, password, code)).rejects.toThrow('Invalid credentials');
  expect((await login(`${code}@example.test`, replacement, code)).user.id).toBe(userId);
  const events = await prisma.auditLog.findMany({ where: { propertyId, entityType: 'UserPassword' } });
  expect(events).toHaveLength(1);
  const audit = JSON.stringify(events); expect(audit).not.toContain(password); expect(audit).not.toContain(replacement); expect(audit).not.toContain('$argon2');
});
