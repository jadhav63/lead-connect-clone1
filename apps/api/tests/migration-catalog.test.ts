import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";
// @ts-expect-error Shared executable Node helper.
import { assertRenderTestSession, expectedMigrationCatalog, readMigrationCatalog, assertMigrationCatalog } from "../scripts/migration-catalog.mjs";
const root = new URL("../prisma/migrations/", import.meta.url);
const sql = readdirSync(root).filter((n) => /^\d+_/.test(n)).sort().map((n) => readFileSync(new URL(n + "/migration.sql", root), "utf8")).join("\n");
const expected = expectedMigrationCatalog(sql);
describe("migration connection and catalog verification", () => {
  const verifiedTransport = { encrypted: true, authorized: true, authorizationError: null };
  const directHost = "render-test.example.neon.tech";
  it("accepts client-verified TLS when the Postgres backend also reports TLS", () => {
    expect(() => assertRenderTestSession({ database: "leadconnect", schema: "public", ssl_setting: "on", tls: true }, verifiedTransport, directHost)).not.toThrow();
  });
  it("accepts Neon proxy TLS termination only with verified client TLS and the exact test endpoint", () => {
    expect(() => assertRenderTestSession({ database: "leadconnect", schema: "public", ssl_setting: "off", tls: false }, verifiedTransport, directHost, directHost)).not.toThrow();
  });
  it.each([
    [{ database: "production", schema: "public", ssl_setting: "on", tls: true }, verifiedTransport, directHost],
    [{ database: "leadconnect", schema: "other", ssl_setting: "on", tls: true }, verifiedTransport, directHost],
    [{ database: "leadconnect", schema: "public", ssl_setting: "off", tls: false }, { encrypted: false, authorized: false }, directHost],
    [{ database: "leadconnect", schema: "public", ssl_setting: "off", tls: false }, { encrypted: true, authorized: false, authorizationError: "CERT_UNTRUSTED" }, directHost],
    [{ database: "leadconnect", schema: "public", ssl_setting: "off", tls: false }, verifiedTransport, "production.example.test"],
    [{ database: "leadconnect", schema: "public", ssl_setting: "on", tls: false }, verifiedTransport, directHost],
    [{ database: "leadconnect", schema: "public", ssl_setting: "off", tls: null }, verifiedTransport, directHost],
  ])("refuses an unsafe live session before migration", (session, transport, endpoint) => {
    expect(() => assertRenderTestSession(session, transport, endpoint, directHost)).toThrow("refusing migration");
  });
  it("refuses a TLS-terminated backend from an unapproved endpoint", () => {
    expect(() => assertRenderTestSession({ database: "leadconnect", schema: "public", ssl_setting: "off", tls: false }, verifiedTransport, "other.example.neon.tech", directHost)).toThrow("refusing migration");
  });
  it("derives the reviewed baseline and removes replaced foreign keys", () => {
    expect(assertMigrationCatalog(expected, expected)).toEqual({ models: 17, enums: 12, indexes: 53, foreign_keys: 46 });
    expect(expected.foreignKeys).not.toContain("cleaning_tasks_roomId_fkey");
    expect(expected.foreignKeys).toContain("cleaning_tasks_propertyId_roomId_fkey");
  });
  it.each(["tables", "indexes", "foreignKeys", "enums"])("detects a same-count but wrong %s catalog", (key) => {
    const actual = structuredClone(expected);
    actual[key][0] = key === "enums" ? { name: "UnexpectedEnum", values: ["UNKNOWN"] } : "unexpected_catalog_object";
    expect(() => assertMigrationCatalog(expected, actual)).toThrow("schema verification failed");
  });
  it("detects changed enum order/values even if names and counts match", () => {
    const actual = structuredClone(expected);
    actual.enums[0].values.reverse();
    expect(() => assertMigrationCatalog(expected, actual)).toThrow("enums");
  });
  it("verifies the actual disposable local database catalog", async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try { await client.connect(); expect(assertMigrationCatalog(expected, await readMigrationCatalog(client))).toEqual({ models: 17, enums: 12, indexes: 53, foreign_keys: 46 }); }
    finally { await client.end(); }
  });
});
