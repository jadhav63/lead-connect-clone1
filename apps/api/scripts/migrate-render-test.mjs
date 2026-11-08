import "dotenv/config";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { assertRenderTestTarget } from "./render-test-target.mjs";
import { assertRenderTestSession, expectedMigrationCatalog, readMigrationCatalog, assertMigrationCatalog } from "./migration-catalog.mjs";

async function main() {
  assertRenderTestTarget(process.env);
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 15000,
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    // Validate the actual server session before reading application rows or running DDL.
    const session = await client.query(`SELECT current_database() AS database,
      current_schema() AS schema,
      (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls`);
    assertRenderTestSession(session.rows[0]);
    const tables = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      )
    ).rows.map((r) => r.tablename);
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migration = readdirSync(root)
      .filter((name) => /^\d+_/.test(name))
      .sort()
      .map((name) =>
        readFileSync(new URL(name + "/migration.sql", root), "utf8"),
      )
      .join("\n");
    const expected = expectedMigrationCatalog(migration);
    const expectedTables = expected.tables;
    if (
      tables.some(
        (t) => t !== "_prisma_migrations" && !expectedTables.includes(t),
      )
    ) {
      throw new Error(
        "Unexpected public tables; review the test database before migrating",
      );
    }
    // Initial schema only: refuse all existing application rows, even test rows.
    for (const table of tables.filter((t) => expectedTables.includes(t))) {
      const count = await client.query(
        `SELECT EXISTS (SELECT 1 FROM "public"."${table}") AS populated`,
      );
      if (count.rows[0].populated)
        throw new Error(
          "Existing application data detected; manual review required",
        );
    }
    console.log(
      "Verified render-test/leadconnect with no existing application rows.",
    );
    if (process.argv.includes("--check")) return;

    const cli = fileURLToPath(
      new URL("../node_modules/prisma/build/index.js", import.meta.url),
    );
    for (const args of [
      ["validate"],
      ["migrate", "deploy"],
      ["migrate", "status"],
      [
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "prisma/schema.prisma",
        "--exit-code",
      ],
    ]) {
      const result = spawnSync(process.execPath, [cli, ...args], {
        env: process.env,
        encoding: "utf8",
        timeout: 120000,
      });
      // Never print child diagnostics that could include URLs or credentials.
      if (result.status !== 0)
        throw new Error(
          `Prisma ${args.slice(0, 2).join(" ")} failed; inspect privately before retrying`,
        );
      console.log(`Prisma ${args.slice(0, 2).join(" ")}: passed`);
    }
    const catalog = await readMigrationCatalog(client);
    console.log("Test migration verified:", assertMigrationCatalog(expected, catalog));
  } finally {
    if (connected) await client.end();
    else await client.end().catch(() => {});
  }
}
main().catch((error) => {
  // Only these fixed messages are safe to display. Raw driver errors may contain secrets.
  const safe =
    /^(DATABASE_URL:|DIRECT_URL:|Unexpected public|Existing application|Prisma |Unexpected migrated|Unexpected database, schema, or negotiated TLS; refusing migration$)/.test(
      error.message,
    );
  console.error(
    safe
      ? error.message
      : "Cannot connect to the verified test database. Check DNS, network access, and private credentials.",
  );
  process.exitCode = 1;
});
