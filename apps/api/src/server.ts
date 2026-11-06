import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/db.js';
const server = app.listen(env.PORT, () => console.log(`Lead Connect API listening on ${env.PORT}`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
