import request from 'supertest';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ login: vi.fn(), refresh: vi.fn() }));
vi.mock('../src/lib/db.js', () => ({ prisma: {}, databasePool: { waitingCount: 0 }, verifyDatabaseReadiness: vi.fn() }));
vi.mock('../src/services/auth.js', () => ({ login: mocks.login, rotateRefresh: mocks.refresh, revokeRefresh: vi.fn(), changePassword: vi.fn() }));
import { app } from '../src/app.js';
import { HttpError } from '../src/lib/errors.js';
it('does not share a ten-attempt bucket across employees or with refresh requests', async () => {
  mocks.login.mockRejectedValue(new HttpError(401, 'Invalid credentials'));
  for (let n = 0; n < 12; n++) {
    expect((await request(app).post('/api/auth/login').send({ email: `nat-${n}@example.test`, propertyCode: 'TEST', password: 'invalid' })).status).toBe(401);
  }
  for (let n = 0; n < 10; n++) await request(app).post('/api/auth/login').send({ email: 'blocked@example.test', propertyCode: 'TEST', password: 'invalid' });
  expect((await request(app).post('/api/auth/login').send({ email: 'blocked@example.test', propertyCode: 'TEST', password: 'invalid' })).status).toBe(429);
  mocks.refresh.mockResolvedValue({ accessToken: 'disposable', refreshToken: 'a'.repeat(48) });
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'b'.repeat(48) })).status).toBe(200);
});
