import express from 'express';
import request from 'supertest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { installWebApp } from '../src/lib/web-app.js';
const dir = mkdtempSync(join(tmpdir(), 'lead-connect-static-'));
writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Staff operations</title>');
writeFileSync(join(dir, 'asset.js'), 'void 0');
afterAll(() => rmSync(dir, { recursive: true }));
it('serves same-origin SPA routes but never masks unknown API routes or missing assets', async () => {
  const app = express(); installWebApp(app, dir); app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
  const home = await request(app).get('/rooms').set('Accept', 'text/html');
  expect(home.status).toBe(200); expect(home.headers['cache-control']).toBe('no-store');
  expect((await request(app).get('/api/unknown').set('Accept', 'text/html')).status).toBe(404);
  expect((await request(app).get('/missing.js')).status).toBe(404);
  expect((await request(app).get('/asset.js')).headers['cache-control']).toContain('immutable');
});
it('refuses a missing configured frontend build', () => {
  expect(() => installWebApp(express(), join(dir, 'missing'))).toThrow('build is missing');
});
