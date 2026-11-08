import type { Server } from 'node:http';

export function gracefulShutdown(server: Server, disconnect: () => Promise<void>, markDraining: () => void, timeoutMs = 25_000) {
  let pending: Promise<void> | undefined;
  return () => pending ??= (async () => {
    markDraining();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => server.closeAllConnections(), timeoutMs);
      timer.unref();
      server.close(error => {
        clearTimeout(timer);
        if (error) reject(error); else resolve();
      });
      server.closeIdleConnections();
    });
    await disconnect();
  })();
}
