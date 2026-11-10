import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import pg from 'pg';
import { assertProductionTarget, databaseConfiguration, DatabaseConfigurationError } from './database-config.js';
import { databaseFailureLog } from './database-diagnostics.js';

const settings = databaseConfiguration(env.DATABASE_URL, env.NODE_ENV === 'production', env.APP_ENV === 'staging' || process.env.RENDER_SERVICE_NAME === 'lead-connect-api-staging');
if (env.APP_ENV === 'production') {
  if (Object.keys(process.env).some(key => key.startsWith('DEMO_'))) throw new DatabaseConfigurationError('DEMO_SECRETS_FORBIDDEN');
  assertProductionTarget(settings.config, { host: env.EXPECTED_DATABASE_HOST, database: env.EXPECTED_DATABASE_NAME, user: env.EXPECTED_DATABASE_USER });
}
export const databasePool = new pg.Pool(settings.config);
const adapter = new PrismaPg(databasePool, { schema: settings.schema, disposeExternalPool: true,
  onPoolError: error => console.error(databaseFailureLog(error, 'pool', databasePool.waitingCount)),
  onConnectionError: error => console.error(databaseFailureLog(error, 'connection', databasePool.waitingCount)),
});
export const prisma = new PrismaClient({ adapter });

if (env.NODE_ENV !== 'test') console.info(JSON.stringify({ event: 'database_configuration', ...settings.metadata }));

export async function verifyDatabaseReadiness() {
  const client = await databasePool.connect();
  try {
    if (settings.config.ssl) {
      const stream = (client as unknown as { connection: { stream: { encrypted?: boolean; authorized?: boolean } } }).connection.stream;
      if (!stream.encrypted || stream.authorized !== true) throw Object.assign(new Error('Database TLS verification failed'), { code: 'TLS_NOT_AUTHORIZED' });
    }
    const result = await client.query<{ database: string; schema: string }>('SELECT current_database() AS database, current_schema() AS schema');
    if (result.rows[0]?.database !== settings.config.database) throw Object.assign(new Error('Database identity mismatch'), { code: 'DATABASE_TARGET_MISMATCH' });
    if (result.rows[0]?.schema !== settings.schema) throw Object.assign(new Error('Database schema mismatch'), { code: 'DATABASE_SCHEMA_MISMATCH' });
  } finally { client.release(); }
  await prisma.$queryRaw`SELECT 1`;
}
