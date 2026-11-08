import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it, vi } from 'vitest';
import { gracefulShutdown } from '../src/lib/shutdown.js';
it('finishes an in-flight request before disconnecting the database and runs once', async () => {
  let finished = false;
  const server = createServer((_req, res) => setTimeout(() => { finished = true; res.end('saved'); }, 30));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const active = fetch(`http://127.0.0.1:${port}`).then(r => r.text());
  await once(server, 'request');
  const disconnect = vi.fn(async () => { expect(finished).toBe(true); });
  const mark = vi.fn(); const shutdown = gracefulShutdown(server, disconnect, mark, 1000);
  await Promise.all([shutdown(), shutdown()]);
  expect(await active).toBe('saved'); expect(disconnect).toHaveBeenCalledOnce(); expect(mark).toHaveBeenCalledOnce();
});
