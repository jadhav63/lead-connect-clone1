import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
// Run only against a dedicated disposable test database.
const testPassword = randomBytes(32).toString('hex');
const suffix = `test-${process.pid}`;
const code = `TEST${process.pid}`;
let propertyId = '';
let userId = '';
let refresh = '';
let token = '';
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('leadconnect_test')) throw new Error('Use leadconnect_test database for integration tests');
  const property = await prisma.property.create({ data: { name: suffix, code } });
  propertyId = property.id;
  const user = await prisma.user.create({ data: {
    name: 'Test Manager', email: `${suffix}@example.test`,
    passwordHash: await argon2.hash(testPassword)
  }});
  userId = user.id;
  await prisma.propertyMembership.create({ data: { propertyId, userId, role: 'MANAGER' } });
});
afterAll(async () => {
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { propertyId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.propertyMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
  }
  await prisma.$disconnect();
});
describe('authentication integration', () => {
  it('rejects incorrect credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: `${suffix}@example.test`, password: 'wrong', propertyCode: code });
    expect(res.status).toBe(401);
  });
  it('logs in and returns property-scoped identity', async () => {
    const res = await request(app).post('/api/auth/login').set('X-Client-Platform','mobile').send({ email: `${suffix}@example.test`, password: testPassword, propertyCode: code });
    expect(res.status).toBe(200);
    token = res.body.accessToken; refresh = res.body.refreshToken;
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.roles).toContain('MANAGER');
    expect(me.body.propertyId).toBe(propertyId);
  });
  it('rotates refresh tokens and rejects replay', async () => {
    const old = refresh;
    const res = await request(app).post('/api/auth/refresh').set('X-Client-Platform','mobile').send({ refreshToken: old });
    expect(res.status).toBe(200);
    refresh = res.body.refreshToken;
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: old });
    expect(replay.status).toBe(401);
  });
  it('rejects unauthenticated user creation', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(401);
  });
});
