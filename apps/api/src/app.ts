import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { HttpError } from './lib/errors.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import { prisma } from './lib/db.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', application: 'Lead Connect Clone', timestamp: new Date().toISOString() }));
app.get('/api/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: 'Invalid request', issues: error.issues }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
  if (error?.code === 'P2002') { res.status(409).json({ error: 'Record already exists' }); return; }
  console.error('Unhandled request error', error);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);
