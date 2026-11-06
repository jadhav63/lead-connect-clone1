import { randomBytes } from 'node:crypto';
import 'dotenv/config';
// @ts-expect-error The safety helper is also executable by Node without compiling.
import { assertTestDatabase } from '../scripts/test-database.mjs';
assertTestDatabase(process.env.DATABASE_URL);
process.env.NODE_ENV = 'test';
// Test secrets are ephemeral and never copied from a production environment.
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('hex');
process.env.CORS_ORIGIN = 'http://localhost:5173';
