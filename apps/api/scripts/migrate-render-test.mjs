import 'dotenv/config';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { assertRenderTestTarget } from './render-test-target.mjs';

async function main() {
  assertRenderTestTarget(process.env);
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 15000 });
  let connected = false;
  try {
    await client.connect(); connected = true;
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(r => r.tablename);
    const migration = readFileSync(new URL('../prisma/migrations/20261106224608_init/migration.sql', import.meta.url), 'utf8');
    const expectedTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m => m[1]);
    if (tables.some(t => t !== '_prisma_migrations' && !expectedTables.includes(t))) {
      throw new Error('Unexpected public tables; review the test database before migrating');
    }
    // Initial schema only: refuse all existing application rows, even test rows.
    for (const table of tables.filter(t => expectedTables.includes(t))) {
      const count = await client.query(`SELECT EXISTS (SELECT 1 FROM "${table}") AS populated`);
      if (count.rows[0].populated) throw new Error('Existing application data detected; manual review required');
    }
    console.log('Verified render-test/leadconnect with no existing application rows.');
    if (process.argv.includes('--check')) return;

    const cli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
    for (const args of [ ['validate'], ['migrate', 'deploy'], ['migrate', 'status'],
      ['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'] ]) {
      const result = spawnSync(process.execPath, [cli, ...args], { env: process.env, encoding: 'utf8', timeout: 120000 });
      // Never print child diagnostics that could include URLs or credentials.
      if (result.status !== 0) throw new Error(`Prisma ${args.slice(0,2).join(' ')} failed; inspect privately before retrying`);
      console.log(`Prisma ${args.slice(0,2).join(' ')}: passed`);
    }
    const catalog = await client.query(`SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations') AS models,
      (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS enums,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations') AS indexes,
      (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f') AS foreign_keys`);
    if (catalog.rows[0].models !== 12 || catalog.rows[0].enums !== 10) throw new Error('Unexpected migrated catalog counts');
    console.log('Test migration verified:', catalog.rows[0]);
  } finally {
    if (connected) await client.end();
    else await client.end().catch(() => {});
  }
}
main().catch(error => {
  // Only these fixed messages are safe to display. Raw driver errors may contain secrets.
  const safe = /^(DATABASE_URL:|DIRECT_URL:|Unexpected public|Existing application|Prisma |Unexpected migrated)/.test(error.message);
  console.error(safe ? error.message : 'Cannot connect to the verified test database. Check DNS, network access, and private credentials.');
  process.exitCode = 1;
});
