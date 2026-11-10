import { expect, it } from 'vitest';
import { assertProductionTarget, STAGING_DATABASE_HOST, TGH_PRODUCTION_DATABASE_HOST } from '../src/lib/database-config.js';

const expected = { host: TGH_PRODUCTION_DATABASE_HOST, database: 'leadconnect', user: 'neondb_owner' };
const connection = { ...expected, ssl: { rejectUnauthorized: true }, enableChannelBinding: true };

it('permits the exact verified Tombstone production target with validated TLS', () => {
  expect(() => assertProductionTarget(connection, expected)).not.toThrow();
});

it('refuses staging, different hosts, wrong databases, wrong users, disabled TLS or channel binding', () => {
  for (const override of [
    { host: STAGING_DATABASE_HOST },
    { host: 'ep-independent-production-pooler.c-4.us-west-2.aws.neon.tech' },
    { database: 'leadconnect_production' },
    { database: 'other' },
    { user: 'leadconnect_app' },
    { host: undefined },
  ]) {
    expect(() => assertProductionTarget({ ...connection, ...override }, { ...expected, ...override })).toThrow('Invalid database');
  }
  expect(() => assertProductionTarget({ ...connection, database: 'other' }, expected)).toThrow();
  expect(() => assertProductionTarget({ ...connection, ssl: false }, expected)).toThrow();
  expect(() => assertProductionTarget({ ...connection, ssl: { rejectUnauthorized: false } }, expected)).toThrow();
  expect(() => assertProductionTarget({ ...connection, enableChannelBinding: false }, expected)).toThrow();
});
