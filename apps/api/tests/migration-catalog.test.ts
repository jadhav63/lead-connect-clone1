import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";
// @ts-expect-error Shared executable Node helper.
import { assertRenderTestSession, expectedMigrationCatalog, readMigrationCatalog, assertMigrationCatalog } from "../scripts/migration-catalog.mjs";
const root = new URL("../prisma/migrations/", import.meta.url);
const sql = readdirSync(root).filter((n) => /^\d+_/.test(n)).sort().map((n) => readFileSync(new URL(n + "/migration.sql", root), "utf8")).join("\n");
const expected = expectedMigrationCatalog(sql);
describe("migration connection and catalog verification", () => {
  it("accepts only the actual expected database/schema with negotiated TLS", () => {
    expect(() => assertRenderTestSession({ database: "leadconnect", schema: "public", tls: true })).not.toThrow();
  });
  it.each([
    { database: "production", schema: "public", tls: true },
    { database: "leadconnect", schema: "other", tls: true },
    { database: "leadconnect", schema: "public", tls: false },
    { database: "leadconnect", schema: "public", tls: null },
  ])("refuses an unsafe live session before migration: %j", (session) => {
    expect(() => assertRenderTestSession(session)).toThrow("refusing migration");
  });
  it("derives the reviewed baseline and removes replaced foreign keys", () => {
    expect(assertMigrationCatalog(expected, expected)).toEqual({ models: 14, enums: 11, indexes: 41, foreign_keys: 34 });
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
    try { await client.connect(); expect(assertMigrationCatalog(expected, await readMigrationCatalog(client))).toEqual({ models: 14, enums: 11, indexes: 41, foreign_keys: 34 }); }
    finally { await client.end(); }
  });
});
