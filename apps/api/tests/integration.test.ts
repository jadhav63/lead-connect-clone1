import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { login, rotateRefresh } from '../src/services/auth.js';
import { accessToken, hashToken } from '../src/lib/tokens.js';
// Run only against a dedicated disposable test database.
const testPassword = randomBytes(32).toString('hex');
const suffix = `test-${process.pid}`;
const code = `TEST${process.pid}`;
let propertyId = '';
let userId = '';
let refresh = '';
let token = '';
const createdUserIds: string[] = [];
beforeAll(async () => {
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
  if (propertyId) {
    await prisma.auditLog.deleteMany({ where: { propertyId } });
    await prisma.refreshToken.deleteMany({ where: { propertyId } });
    await prisma.propertyMembership.deleteMany({ where: { propertyId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, ...createdUserIds] } } });
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
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(res.headers['set-cookie'][0]).toContain('SameSite=Strict');
    const stored = await prisma.refreshToken.findFirstOrThrow({ where: { userId } });
    expect(stored.tokenHash).not.toBe(res.body.refreshToken);
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
    const invalidated = await request(app).post('/api/auth/refresh').send({ refreshToken: refresh });
    expect(invalidated.status).toBe(401);
  });
  it('rejects unauthenticated user creation', async () => {
    const res = await request(app).post('/api/users').send({});
    expect(res.status).toBe(401);
  });
});

describe('authorization and request safety', () => {
  it('rejects a foreign browser origin before processing credentials', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://untrusted.example.test').send({});
    expect(res.status).toBe(403);
  });
  it('rejects malformed JSON without reporting internal errors', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{');
    expect(res.status).toBe(400);
  });
  it('does not allow a manager to create another manager', async () => {
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      name: 'Disposable User', email: `${suffix}-denied@example.test`, password: testPassword, role: 'MANAGER'
    });
    expect(res.status).toBe(403);
  });
  it('creates staff only in the authenticated property and stores an Argon2id hash', async () => {
    const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      name: 'Disposable User', email: `${suffix}-staff@example.test`, password: testPassword, role: 'HOUSEKEEPING', propertyId: 'untrusted-property'
    });
    if (res.body.id) createdUserIds.push(res.body.id);
    expect(res.status).toBe(201);
    expect(res.body.passwordHash).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id }, include: { memberships: true } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(user.passwordHash, testPassword)).toBe(true);
    expect(user.memberships[0].propertyId).toBe(propertyId);
  });
  it('revokes access immediately when property membership becomes inactive', async () => {
    await prisma.propertyMembership.updateMany({ where: { userId, propertyId }, data: { isActive: false } });
    try {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    } finally {
      await prisma.propertyMembership.updateMany({ where: { userId, propertyId }, data: { isActive: true } });
    }
  });
  it('rejects a validly signed token for a property without a membership', async () => {
    const { accessToken } = await import('../src/lib/tokens.js');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken(userId, 'unrelated-property')}`);
    expect(res.status).toBe(401);
  });
  it('keeps browser refresh tokens out of JSON and supports cookie logout', async () => {
    const client = request.agent(app);
    const loggedIn = await client.post('/api/auth/login').send({ email: `${suffix}@example.test`, password: testPassword, propertyCode: code });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.refreshToken).toBeUndefined();
    const loggedOut = await client.post('/api/auth/logout').send({});
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  });
  it('uses the same generic error for an unknown account', async () => {
    await expect(login(`${suffix}-missing@example.test`, testPassword, code)).rejects.toThrow('Invalid credentials');
  });
  it('rejects expired refresh tokens', async () => {
    const session = await login(`${suffix}@example.test`, testPassword, code);
    await prisma.refreshToken.update({ where: { tokenHash: hashToken(session.refreshToken) }, data: { expiresAt: new Date(0) } });
    await expect(rotateRefresh(session.refreshToken)).rejects.toThrow('Invalid session');
  });
  it('rejects disabled users during refresh and bearer authorization', async () => {
    const session = await login(`${suffix}@example.test`, testPassword, code);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    try {
      await expect(rotateRefresh(session.refreshToken)).rejects.toThrow('Invalid session');
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${session.accessToken}`);
      expect(res.status).toBe(401);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    }
  });
  it('denies housekeeping users permission to create accounts', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${accessToken(createdUserIds[0], propertyId)}`).send({});
    expect(res.status).toBe(403);
  });
  it('never issues two successful rotations of the same refresh token', async () => {
    const session = await login(`${suffix}@example.test`, testPassword, code);
    const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken })));
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect(results.every(result => [200, 401, 409].includes(result.status))).toBe(true);
  });
  it('throttles repeated login attempts', async () => {
    let status = 0;
    for (let i = 0; i < 11; i++) {
      status = (await request(app).post('/api/auth/login').send({})).status;
      if (status === 429) break;
    }
    expect(status).toBe(429);
  });
});
