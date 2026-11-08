import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { proxyTrustSetting } from './config/proxy.js';
import { HttpError } from './lib/errors.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import operationsRouter from './routes/operations.js';
import { prisma } from './lib/db.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', proxyTrustSetting(env.NODE_ENV));
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', application: 'Lead Connect Clone', timestamp: new Date().toISOString() }));
app.get('/api/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api', operationsRouter);
app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: 'Invalid request', issues: error.issues }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error?.code === 'P2002') { res.status(409).json({ error: 'Record already exists' }); return; }
  if (error?.code === 'P2025') { res.status(404).json({ error: 'Record not found' }); return; }
  if (error?.code === 'P2003') { res.status(409).json({ error: 'Related records prevent this change' }); return; }
  if (error?.code === 'P2034') { res.status(409).json({ error: 'Session or record changed; retry the request' }); return; }
  if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON' }); return; }
  if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Request too large' }); return; }
  // Do not log driver errors, query parameters, connection URLs, or request bodies.
  console.error('Unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);
