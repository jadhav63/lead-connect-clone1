// Derive catalog expectations from reviewed, committed migration DDL only.
export function expectedMigrationCatalog(sql) {
  const names = (pattern) => [...sql.matchAll(pattern)].map((m) => m[1]);
  const foreignKeys = new Set();
  for (const m of sql.matchAll(/(?:ADD CONSTRAINT "([^"]+)" FOREIGN KEY|DROP CONSTRAINT "([^"]+)")/g)) {
    if (m[1]) foreignKeys.add(m[1]);
    else foreignKeys.delete(m[2]);
  }
  return {
    tables: names(/CREATE TABLE "([^"]+)"/g).sort(),
    indexes: [...names(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g), ...names(/CONSTRAINT "([^"]+)" PRIMARY KEY/g)].sort(),
    foreignKeys: [...foreignKeys].sort(),
    enums: [...sql.matchAll(/CREATE TYPE "([^"]+)" AS ENUM \(([^;]+)\);/g)]
      .map((m) => ({ name: m[1], values: [...m[2].matchAll(/'([^']+)'/g)].map((v) => v[1]) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export function assertRenderTestSession(session, transport, endpointHost, approvedEndpointHost) {
  const validClientTls = transport?.encrypted === true
    && transport?.authorized === true
    && transport?.authorizationError == null;
  const validBackendObservation = (session?.tls === true && session.ssl_setting === "on")
    || (session?.tls === false && session.ssl_setting === "off");
  // Neon can terminate client TLS at its connection proxy. In that topology,
  // pg_stat_ssl describes the proxy-to-Postgres socket (false) rather than the
  // Node-to-Neon TLS socket. Accept that observation only when the actual Node
  // TLS socket is verified and the endpoint matches the independently supplied
  // expected host.
  if (session?.database !== "leadconnect"
      || session?.schema !== "public"
      || !validClientTls
      || !validBackendObservation
      || (session.tls === false && (!approvedEndpointHost || endpointHost !== approvedEndpointHost))) {
    throw new Error("Unexpected database, schema, or verified TLS transport; refusing migration");
  }
}
export async function readMigrationCatalog(client) {
  const tables = await client.query("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
  const indexes = await client.query("SELECT indexname AS name FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
  const foreignKeys = await client.query("SELECT c.conname AS name FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND c.contype='f'");
  const enums = await client.query("SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname");
  return {
    tables: tables.rows.map((r) => r.name).sort(),
    indexes: indexes.rows.map((r) => r.name).sort(),
    foreignKeys: foreignKeys.rows.map((r) => r.name).sort(),
    enums: enums.rows.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export function assertMigrationCatalog(expected, actual) {
  for (const key of ["tables", "indexes", "foreignKeys", "enums"]) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
      throw new Error(`Unexpected migrated ${key}; schema verification failed`);
  }
  return { models: actual.tables.length, enums: actual.enums.length, indexes: actual.indexes.length, foreign_keys: actual.foreignKeys.length };
}
