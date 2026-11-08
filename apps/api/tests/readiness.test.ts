import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
const check = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({ prisma: {}, databasePool: { waitingCount: 0 }, verifyDatabaseReadiness: check }));
import { app } from '../src/app.js';

afterEach(() => { vi.restoreAllMocks(); check.mockReset(); });
describe('public readiness privacy', () => {
  it('returns only unavailable while recording an allowlisted authentication failure privately', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    check.mockRejectedValue(Object.assign(new Error('password=private-sentinel postgresql://private-sentinel'), { code: '28P01' }));
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(log).toHaveBeenCalledWith('{"event":"database_failure","phase":"readiness","category":"authentication_failure","code":"28P01"}');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-sentinel');
  });
  it('requires the real connection check before returning ready', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    check.mockResolvedValue(undefined);
    const response = await request(app).get('/api/ready');
    expect(check).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });
});
