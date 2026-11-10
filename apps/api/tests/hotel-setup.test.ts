import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import { accessToken } from "../src/lib/tokens.js";
import { env } from "../src/config/env.js";
import type { UserRole } from "../src/generated/prisma/enums.js";

const hotelPropertyId = randomUUID();
const demoPropertyId = randomUUID();
const users: string[] = [];
const auth: Record<string, string> = {};
let staffEntryId = "";

function api(role: string) {
  return {
    get: (path: string) => request(app).get("/api" + path).set("Authorization", `Bearer ${auth[role]}`),
    post: (path: string, body: unknown) => request(app).post("/api" + path).set("Authorization", `Bearer ${auth[role]}`).send(body),
    patch: (path: string, body: unknown) => request(app).patch("/api" + path).set("Authorization", `Bearer ${auth[role]}`).send(body),
  };
}

beforeAll(async () => {
  await prisma.property.create({ data: { id: hotelPropertyId, name: "Fictional TGH test fixture", code: "58835", timezone: "America/Phoenix" } });
  await prisma.property.create({ data: { id: demoPropertyId, name: "Canyon Lantern Demo Lodge", code: "LCD60", timezone: "America/Phoenix" } });
  const passwordHash = await argon2.hash(randomBytes(32));
  for (const [name, role, propertyId] of [
    ["manager", "MANAGER", hotelPropertyId],
    ["frontDesk", "FRONT_DESK", hotelPropertyId],
    ["demoManager", "MANAGER", demoPropertyId],
  ] as const) {
    const user = await prisma.user.create({ data: {
      name: `Fictional ${name}`,
      email: `${randomUUID()}@example.test`,
      passwordHash,
      memberships: { create: { propertyId, role: role as UserRole } },
    } });
    users.push(user.id);
    auth[name] = accessToken(user.id, propertyId);
  }
});

afterAll(async () => {
  const propertyIds = [hotelPropertyId, demoPropertyId];
  await prisma.auditLog.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await prisma.staffDirectoryEntry.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await prisma.roomStatusEvent.deleteMany({ where: { room: { propertyId: { in: propertyIds } } } });
  await prisma.room.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await prisma.propertyMembership.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.property.deleteMany({ where: { id: { in: propertyIds } } });
  await prisma.$disconnect();
});

function fictionalRooms() {
  const roomTypes = ["AC1", "AC2", "AC2", "AC3", ...Array(5).fill("RM1"), ...Array(42).fill("RM2"), ...Array(8).fill("RM3"), "SU1"];
  return roomTypes.map((roomType, i) => ({ number: String(100 + i), floor: 1, roomType }));
}

describe("property setup and employee directory", () => {
  it("validates 60 fictional rooms without writing and reports current-status gaps", async () => {
    const result = await api("manager").post("/room-inventory/preview", { propertyCode: "58835", rooms: fictionalRooms() });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ total: 60, toCreate: 60, alreadyPresent: 0, databaseModified: false, canApply: false, approvedInventoryMatch: false });
    expect(result.body.inventoryFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.body.missingInitialStatus).toHaveLength(60);
    expect(await prisma.room.count({ where: { propertyId: hotelPropertyId } })).toBe(0);
    const originalFingerprint = env.TGH_APPROVED_ROOM_INVENTORY_SHA256;
    try {
      env.TGH_APPROVED_ROOM_INVENTORY_SHA256 = result.body.inventoryFingerprint;
      const approved = await api("manager").post("/room-inventory/preview", { propertyCode: "58835", rooms: fictionalRooms() });
      expect(approved.body.approvedInventoryMatch).toBe(true);
      expect(approved.body.canApply).toBe(false);
    } finally {
      env.TGH_APPROVED_ROOM_INVENTORY_SHA256 = originalFingerprint;
    }
  });

  it("rejects duplicate room numbers and incorrect room-type totals", async () => {
    const duplicate = fictionalRooms();
    duplicate[1].number = duplicate[0].number;
    expect((await api("manager").post("/room-inventory/preview", { propertyCode: "58835", rooms: duplicate })).status).toBe(400);
    const wrongCounts = fictionalRooms();
    wrongCounts[0].roomType = "RM2";
    expect((await api("manager").post("/room-inventory/preview", { propertyCode: "58835", rooms: wrongCounts })).status).toBe(400);
  });

  it("does not expose Tombstone inventory tools or staff across properties", async () => {
    expect((await api("demoManager").post("/room-inventory/preview", { propertyCode: "58835", rooms: fictionalRooms() })).status).toBe(403);
    expect((await api("demoManager").get("/staff-directory")).body).toEqual([]);
  });

  it("allows manager directory entry without email and keeps login access disabled", async () => {
    const created = await api("manager").post("/staff-directory", { name: "Fictional Directory Housekeeper", department: "Housekeeping" });
    expect(created.status).toBe(201);
    staffEntryId = created.body.id;
    expect(created.body).toMatchObject({ email: null, appAccessEnabled: false, employmentStatus: "PENDING_REVIEW", propertyId: hotelPropertyId });
    expect(await prisma.user.count({ where: { id: staffEntryId } })).toBe(0);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "StaffDirectoryEntry", entityId: staffEntryId, action: "CREATE" } });
    expect(JSON.stringify(audit.after)).not.toContain("Fictional Directory Housekeeper");
    expect(JSON.stringify(audit.after)).not.toContain("@example.test");
  });

  it("restricts edits to managers, scopes entries to the manager property, and audits changed field names only", async () => {
    expect((await api("frontDesk").get("/staff-directory")).status).toBe(403);
    expect((await api("frontDesk").patch(`/staff-directory/${staffEntryId}`, { phone: "5205550101" })).status).toBe(403);
    expect((await api("demoManager").patch(`/staff-directory/${staffEntryId}`, { email: "" })).status).toBe(404);
    const edited = await api("manager").patch(`/staff-directory/${staffEntryId}`, { email: "", jobRole: "Room Attendant", employmentStatus: "ACTIVE" });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ email: null, jobRole: "Room Attendant", employmentStatus: "ACTIVE", appAccessEnabled: false });
    const persisted = await api("manager").get("/staff-directory");
    expect(persisted.body.find((entry: { id: string }) => entry.id === staffEntryId)).toMatchObject({ email: null, jobRole: "Room Attendant", employmentStatus: "ACTIVE" });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "StaffDirectoryEntry", entityId: staffEntryId, action: "UPDATE" } });
    expect(audit.after).toEqual({ changedFields: ["email", "jobRole", "employmentStatus"] });
    expect((await api("manager").post("/staff-directory", { name: " fictional  directory HOUSEKEEPER " })).status).toBe(409);
  });

  it("previews employees with missing email but blocks imports outside approved production", async () => {
    const records = [{ name: "Fictional No Email Employee" }];
    const preview = await api("manager").post("/staff-directory/import-preview", { propertyCode: "58835", records });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ total: 1, toCreate: 1, missingEmails: 1, allAppAccessDisabled: true, databaseModified: false });
    expect((await api("manager").post("/staff-directory/import", { propertyCode: "58835", records, approvalReference: "JD-APPROVED-TEST-0001" })).status).toBe(403);
    expect((await prisma.staffDirectoryEntry.findMany({ where: { propertyId: hotelPropertyId } })).map(x => x.name)).toEqual(["Fictional Directory Housekeeper"]);
  });

  it("blocks room imports outside approved production", async () => {
    const rooms = fictionalRooms().map(r => ({ ...r, initialStatus: "CLEAN", initialOccupancyStatus: "VACANT" }));
    const result = await api("manager").post("/room-inventory/apply", { propertyCode: "58835", rooms, approvalReference: "JD-APPROVED-TEST-0001" });
    expect(result.status).toBe(403);
    expect(await prisma.room.count({ where: { propertyId: hotelPropertyId } })).toBe(0);
  });

  it('prevents manual room creation and map changes from bypassing the approved real-hotel inventory', async()=>{
    expect((await api('manager').post('/rooms',{number:'199',floor:1})).status).toBe(403);
    const row=await prisma.room.create({data:{propertyId:hotelPropertyId,number:'199',floor:1,roomType:'AC1',status:'DIRTY',occupancyStatus:'OCCUPIED'}});
    expect((await api('manager').patch('/rooms/'+row.id,{version:row.version,roomType:'RM2'})).status).toBe(403);
    expect((await api('manager').patch('/rooms/'+row.id,{version:row.version,floor:2})).status).toBe(403);
    const update=await api('manager').patch('/rooms/'+row.id,{version:row.version,notes:'Fictional operational note',roomType:'AC1',floor:1});
    expect(update.status).toBe(200);expect(update.body).toMatchObject({roomType:'AC1',floor:1,occupancyStatus:'OCCUPIED',status:'DIRTY'});
  });
});
