import 'dotenv/config';
import { z } from 'zod';
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().refine(value => value.startsWith('postgresql://'), 'Use a PostgreSQL URL'),
  JWT_ACCESS_SECRET: z.string().min(48),
  ACCESS_TOKEN_TTL: z.literal('15m').default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CORS_ORIGIN: z.string().url().refine(value => new URL(value).origin === value, 'Use an exact origin without a path or trailing slash'),
  WEB_DIST_PATH: z.string().min(1).optional(),
  AUTH_COOKIE_SAME_SITE: z.enum(['strict', 'none']).default('strict'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  TGH_IMPORT_ENABLED: z.enum(['true', 'false']).default('false'),
  TGH_APPROVED_ROOM_INVENTORY_SHA256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  EXPECTED_DATABASE_HOST: z.string().optional(),
  EXPECTED_DATABASE_NAME: z.string().optional(),
  EXPECTED_DATABASE_USER: z.string().optional(),
}).superRefine((value, context) => {
  if (value.TGH_IMPORT_ENABLED === 'true' && value.APP_ENV !== 'production') {
    context.addIssue({ code: 'custom', path: ['TGH_IMPORT_ENABLED'], message: 'Tombstone inventory imports can only be enabled in production' });
  }
  if (value.TGH_IMPORT_ENABLED === 'true' && !value.TGH_APPROVED_ROOM_INVENTORY_SHA256) {
    context.addIssue({ code: 'custom', path: ['TGH_APPROVED_ROOM_INVENTORY_SHA256'], message: 'An approved room inventory SHA-256 is required before imports can be enabled' });
  }
  if (value.APP_ENV === 'production' && (value.NODE_ENV !== 'production' || !value.WEB_DIST_PATH
      || !value.EXPECTED_DATABASE_HOST || !value.EXPECTED_DATABASE_NAME || !value.EXPECTED_DATABASE_USER
      || value.AUTH_COOKIE_SAME_SITE !== 'strict')) {
    context.addIssue({ code: 'custom', path: ['APP_ENV'], message: 'Production requires verified database identity and same-origin secure browser delivery' });
  }
  if (value.AUTH_COOKIE_SAME_SITE === 'none' && value.NODE_ENV !== 'production') {
    context.addIssue({ code: 'custom', path: ['AUTH_COOKIE_SAME_SITE'], message: 'Cross-site cookies require secure HTTPS deployment' });
  }
  if (value.NODE_ENV === 'production') {
    const mode = new URL(value.DATABASE_URL).searchParams.get('sslmode');
    if (mode !== 'verify-full' && mode !== 'require') {
      context.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Production database connections require TLS; runtime always verifies certificates and hostnames' });
    }
    if (!value.CORS_ORIGIN.startsWith('https://')) {
      context.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Production browser origin must use HTTPS' });
    }
  }
});
export const env = environmentSchema.parse(process.env);
