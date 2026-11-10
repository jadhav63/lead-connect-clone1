import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/db.js';
import { gracefulShutdown } from './lib/shutdown.js';
const server = app.listen(env.PORT, '0.0.0.0', () => console.log(`Lead Connect API listening on ${env.PORT}`));
const shutdown = gracefulShutdown(server, () => prisma.$disconnect(), () => { app.locals.draining = true; });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  void shutdown().catch(() => { console.error('Graceful shutdown failed'); process.exitCode = 1; });
});
