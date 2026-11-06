import 'dotenv/config';
import { z } from 'zod';
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().refine(value => value.startsWith('postgresql://'), 'Use a PostgreSQL URL'),
  JWT_ACCESS_SECRET: z.string().min(48),
  ACCESS_TOKEN_TTL: z.literal('15m').default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CORS_ORIGIN: z.string().url(),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production') {
    const mode = new URL(value.DATABASE_URL).searchParams.get('sslmode');
    if (!['require', 'verify-ca', 'verify-full'].includes(mode ?? '')) {
      context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Production database connections must require TLS' });
    }
    if (!value.CORS_ORIGIN.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Production browser origin must use HTTPS' });
    }
  }
});
export const env = environmentSchema.parse(process.env);
