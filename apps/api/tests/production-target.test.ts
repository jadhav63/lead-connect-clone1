import { expect, it } from 'vitest';
import { assertProductionTarget, STAGING_DATABASE_HOST } from '../src/lib/database-config.js';
const expected = { host: 'ep-independent-production-pooler.c-4.us-west-2.aws.neon.tech', database: 'leadconnect_production', user: 'leadconnect_app' };
const connection = { ...expected, ssl: { rejectUnauthorized: true } };
it('refuses staging, missing identity, owner credentials, database substitutions and disabled TLS', () => {
  expect(() => assertProductionTarget(connection, expected)).not.toThrow();
  for (const override of [{ host: STAGING_DATABASE_HOST }, { database: 'leadconnect' }, { user: 'neondb_owner' }, { host: undefined }])
    expect(() => assertProductionTarget({ ...connection, ...override }, { ...expected, ...override })).toThrow('Invalid database');
  expect(() => assertProductionTarget({ ...connection, database: 'other' }, expected)).toThrow();
  expect(() => assertProductionTarget({ ...connection, ssl: false }, expected)).toThrow();
});
