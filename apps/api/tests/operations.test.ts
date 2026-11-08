import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/db.js";
import { accessToken } from "../src/lib/tokens.js";
import type { UserRole } from "../src/generated/prisma/enums.js";
const day = "2026-11-06";
const properties = [randomUUID(), randomUUID()];
const people: Record<string, string> = {};
const tokens: Record<string, string> = {};
let ownRoom = "";
let foreignRoom = "";
let cleaning = "";
let ticket = "";
let fdTask = "";
let handover = "";
const userIds: string[] = [];
function api(role: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api" + path)
        .set("Authorization", `Bearer ${tokens[role]}`),
    post: (path: string, body: unknown) =>
      request(app)
        .post("/api" + path)
        .set("Authorization", `Bearer ${tokens[role]}`)
        .send(body),
    patch: (path: string, body: unknown) =>
      request(app)
        .patch("/api" + path)
        .set("Authorization", `Bearer ${tokens[role]}`)
        .send(body),
  };
}
beforeAll(async () => {
  for (const [i, propertyId] of properties.entries())
    await prisma.property.create({
      data: {
        id: propertyId,
        name: "Fictional test property",
        code: "TEST-" + propertyId,
        timezone: "America/Phoenix",
      },
    });
  const hash = await argon2.hash(randomBytes(32));
  for (const [name, role, property] of [
    ["manager", "MANAGER", 0],
    ["front", "FRONT_DESK", 0],
    ["cleaner", "HOUSEKEEPING", 0],
    ["otherCleaner", "HOUSEKEEPING", 0],
    ["repair", "MAINTENANCE", 0],
    ["foreign", "HOUSEKEEPING", 1],
  ] as const) {
    const u = await prisma.user.create({
      data: {
        name,
        email: `${randomUUID()}@example.test`,
        passwordHash: hash,
        memberships: {
          create: { propertyId: properties[property], role: role as UserRole },
        },
      },
    });
    people[name] = u.id;
    userIds.push(u.id);
    tokens[name] = accessToken(u.id, properties[property]);
  }
  foreignRoom = (
    await prisma.room.create({
      data: { propertyId: properties[1], number: "F1", floor: 1 },
    })
  ).id;
});
afterAll(async () => {
  const scope = { propertyId: { in: properties } };
  const roomIds = (
    await prisma.room.findMany({ where: scope, select: { id: true } })
  ).map((r) => r.id);
  const ticketIds = (
    await prisma.maintenanceTicket.findMany({
      where: scope,
      select: { id: true },
    })
  ).map((r) => r.id);
  await prisma.ticketEvent.deleteMany({
    where: { ticketId: { in: ticketIds } },
  });
  await prisma.roomStatusEvent.deleteMany({
    where: { roomId: { in: roomIds } },
  });
  await prisma.frontDeskTask.deleteMany({ where: scope });
  await prisma.shiftHandover.deleteMany({ where: scope });
  await prisma.photo.deleteMany({ where: scope });
  await prisma.notification.deleteMany({ where: scope });
  await prisma.cleaningTask.deleteMany({ where: scope });
  await prisma.maintenanceTicket.deleteMany({ where: scope });
  await prisma.auditLog.deleteMany({ where: scope });
  await prisma.refreshToken.deleteMany({ where: scope });
  await prisma.room.deleteMany({ where: scope });
  await prisma.propertyMembership.deleteMany({ where: scope });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.property.deleteMany({ where: { id: { in: properties } } });
  await prisma.$disconnect();
});
describe("property-scoped operational workflows", () => {
  it("creates a room with persistent notes", async () => {
    const r = await api("front").post("/rooms", {
      number: "101",
      floor: 1,
      status: "DIRTY",
      occupancyStatus: "DEPARTURE",
      notes: "Fictional note",
    });
    expect(r.status).toBe(201);
    ownRoom = r.body.id;
    expect(r.body.propertyId).toBe(properties[0]);
  });
  it("rejects housekeeping room creation", async () => {
    expect(
      (await api("cleaner").post("/rooms", { number: "102", floor: 1 })).status,
    ).toBe(403);
  });
  it("filters inventory without exposing another property", async () => {
    const r = await api("front").get(
      "/rooms?search=101&occupancyStatus=DEPARTURE",
    );
    expect(r.status).toBe(200);
    expect(r.body.map((x: { id: string }) => x.id)).toEqual([ownRoom]);
    expect(
      (await api("front").get(`/rooms/${foreignRoom}/history`)).status,
    ).toBe(404);
  });
  it("uses versions to reject stale room saves", async () => {
    const first = await api("front").patch(`/rooms/${ownRoom}`, {
      version: 1,
      status: "DIRTY",
    });
    expect(first.status).toBe(200);
    expect(first.body.notes).toBe("Fictional note");
    expect(
      (
        await api("front").patch(`/rooms/${ownRoom}`, {
          version: 1,
          status: "CLEAN",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api("front").patch(`/rooms/${foreignRoom}`, {
          version: 1,
          status: "CLEAN",
        })
      ).status,
    ).toBe(404);
  });
  it("requires property membership and the correct assignee role", async () => {
    const base = {
      roomId: ownRoom,
      scheduledFor: day,
      cleaningType: "CHECKOUT",
    };
    expect(
      (
        await api("front").post("/housekeeping", {
          ...base,
          assignedToId: people.foreign,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("front").post("/housekeeping", {
          ...base,
          assignedToId: people.repair,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("front").post("/housekeeping", {
          ...base,
          roomId: foreignRoom,
        })
      ).status,
    ).toBe(404);
  });
  it("creates a daily assignment and rejects duplicates", async () => {
    const body = {
      roomId: ownRoom,
      scheduledFor: day,
      cleaningType: "CHECKOUT",
      assignedToId: people.cleaner,
    };
    const r = await api("front").post("/housekeeping", body);
    expect(r.status).toBe(201);
    cleaning = r.body.id;
    expect((await api("front").post("/housekeeping", body)).status).toBe(409);
  });
  it("delivers assignment notifications only to the assigned employee", async () => {
    const assigned = await api("cleaner").get("/notifications?unreadOnly=true");
    expect(assigned.status).toBe(200);
    expect(assigned.body).toHaveLength(1);
    expect(assigned.body[0]).toMatchObject({
      type: "TASK_ASSIGNED",
      title: "Cleaning assignment",
      message: "Room 101 was assigned to you.",
      isRead: false,
    });
    const notificationId = assigned.body[0].id;
    expect((await api("otherCleaner").get("/notifications")).body).toHaveLength(0);
    expect((await api("otherCleaner").patch(`/notifications/${notificationId}/read`, {})).status).toBe(404);
    const marked = await api("cleaner").patch(`/notifications/${notificationId}/read`, {});
    expect(marked.status).toBe(200);
    expect(marked.body.isRead).toBe(true);
    expect(marked.body.readAt).toBeTruthy();
    expect((await api("cleaner").get("/notifications?unreadOnly=true")).body).toHaveLength(0);
  });
  it("shows housekeepers only their assigned work", async () => {
    expect(
      (await api("cleaner").get("/housekeeping?date=" + day)).body.map(
        (x: { id: string }) => x.id,
      ),
    ).toEqual([cleaning]);
    expect(
      (await api("otherCleaner").get("/housekeeping?date=" + day)).body,
    ).toHaveLength(0);
    expect(
      (
        await api("otherCleaner").patch("/housekeeping/" + cleaning, {
          status: "IN_PROGRESS",
        })
      ).status,
    ).toBe(403);
  });
  it("moves assigned cleaning through start, completion and supervisor inspection", async () => {
    expect(
      (
        await api("cleaner").patch("/housekeeping/" + cleaning, {
          status: "COMPLETED",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await api("cleaner").patch("/housekeeping/" + cleaning, {
          status: "IN_PROGRESS",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("cleaner").patch("/housekeeping/" + cleaning, {
          status: "COMPLETED",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("cleaner").patch("/housekeeping/" + cleaning, {
          status: "VERIFIED",
        })
      ).status,
    ).toBe(403);
    const r = await api("front").patch("/housekeeping/" + cleaning, {
      status: "VERIFIED",
    });
    expect(r.status).toBe(200);
    expect(r.body.verifiedById).toBe(people.front);
    const room = await prisma.room.findUniqueOrThrow({
      where: { id: ownRoom },
    });
    expect(room.status).toBe("CLEAN");
    expect(room.notes).toBe("Fictional note");
    const cleanedNotice = await api("manager").get("/notifications?unreadOnly=true");
    expect(cleanedNotice.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ROOM_CLEANED", message: "Room 101 was marked cleaned and needs inspection." }),
    ]));
  });
  it("prevents reassignment of completed cleaning records", async () => {
    expect(
      (
        await api("front").patch("/housekeeping/" + cleaning, {
          assignedToId: people.otherCleaner,
        })
      ).status,
    ).toBe(409);
  });
  it("rolls back a daily import if any room is unknown", async () => {
    const r = await api("front").post("/housekeeping/import", {
      date: "2026-11-07",
      rows: [
        { roomNumber: "101", occupancyStatus: "OCCUPIED" },
        { roomNumber: "missing", occupancyStatus: "VACANT" },
      ],
    });
    expect(r.status).toBe(404);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: ownRoom } }))
        .occupancyStatus,
    ).toBe("DEPARTURE");
  });
  it("imports known room states and assignments without losing notes", async () => {
    const r = await api("front").post("/housekeeping/import", {
      date: "2026-11-07",
      rows: [
        {
          roomNumber: "101",
          occupancyStatus: "OCCUPIED",
          cleaningType: "STAYOVER",
          assignedToId: people.cleaner,
        },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.imported).toBe(1);
    expect(
      (await prisma.room.findUniqueOrThrow({ where: { id: ownRoom } })).notes,
    ).toBe("Fictional note");
  });
  it("enforces cross-property room foreign keys even outside API code", async () => {
    await expect(
      prisma.cleaningTask.create({
        data: {
          propertyId: properties[0],
          roomId: foreignRoom,
          createdById: people.front,
          cleaningType: "DEEP_CLEAN",
          scheduledFor: new Date(day),
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.maintenanceTicket.create({
        data: {
          propertyId: properties[0],
          roomId: foreignRoom,
          reportedById: people.front,
          title: "Fictional",
          description: "Fictional",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
  it("creates and assigns a maintenance ticket", async () => {
    expect(
      (
        await api("front").post("/maintenance", {
          title: "Test",
          description: "Test",
          roomId: foreignRoom,
        })
      ).status,
    ).toBe(404);
    const r = await api("front").post("/maintenance", {
      title: "Fictional repair",
      description: "Test fixture only",
      roomId: ownRoom,
      assignedToId: people.repair,
      priority: "HIGH",
    });
    expect(r.status).toBe(201);
    ticket = r.body.id;
    expect((await api("repair").get("/notifications?unreadOnly=true")).body).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "TICKET_ASSIGNED", entityId: ticket }),
    ]));
    expect((await api("manager").get("/notifications?unreadOnly=true")).body).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "MAINTENANCE_CREATED", entityId: ticket }),
    ]));
  });
  it("restricts maintenance changes and requires completion notes", async () => {
    expect(
      (
        await api("cleaner").patch("/maintenance/" + ticket, {
          status: "IN_PROGRESS",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api("repair").patch("/maintenance/" + ticket, {
          status: "IN_PROGRESS",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("repair").patch("/maintenance/" + ticket, {
          status: "CLOSED",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api("repair").patch("/maintenance/" + ticket, {
          status: "CLOSED",
          resolution: "Fictional completion note",
        })
      ).status,
    ).toBe(200);
    expect(
      await prisma.ticketEvent.count({ where: { ticketId: ticket } }),
    ).toBe(3);
  });
  it("creates room inspection tasks with a valid room", async () => {
    expect(
      (
        await api("front").post("/front-desk/tasks", {
          title: "Inspect",
          kind: "INSPECTION",
          shift: "A",
          scheduledFor: day,
        })
      ).status,
    ).toBe(400);
    const r = await api("front").post("/front-desk/tasks", {
      title: "Fictional inspection",
      kind: "INSPECTION",
      shift: "A",
      scheduledFor: day,
      roomId: ownRoom,
      assignedToId: people.front,
    });
    expect(r.status).toBe(201);
    fdTask = r.body.id;
  });
  it("records completed front desk tasks and supervisor verification", async () => {
    expect(
      (
        await api("front").patch("/front-desk/tasks/" + fdTask, {
          status: "COMPLETED",
          notes: "Fictional check",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api("front").patch("/front-desk/tasks/" + fdTask, {
          status: "VERIFIED",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api("manager").patch("/front-desk/tasks/" + fdTask, {
          status: "VERIFIED",
        })
      ).status,
    ).toBe(200);
  });
  it("requires a different incoming user to verify a handover", async () => {
    const r = await api("front").post("/front-desk/handovers", {
      shift: "A",
      businessDate: day,
      notes: "Fictional handover only",
    });
    expect(r.status).toBe(201);
    handover = r.body.id;
    expect(
      (
        await api("front").post(
          "/front-desk/handovers/" + handover + "/verify",
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await api("manager").post(
          "/front-desk/handovers/" + handover + "/verify",
          {},
        )
      ).status,
    ).toBe(200);
  });
  it("restricts reports and keeps audit data property scoped", async () => {
    expect((await api("cleaner").get("/reports?date=" + day)).status).toBe(403);
    const report = await api("manager").get("/reports?date=" + day);
    expect(report.status).toBe(200);
    expect(report.body.verified).toBe(1);
    expect((await api("cleaner").get("/reports?month=2026-11")).status).toBe(403);
    expect((await api("manager").get("/reports?month=2026-13")).status).toBe(400);
    await prisma.cleaningTask.update({
      where: { id: cleaning },
      data: {
        startedAt: new Date("2026-11-08T08:00:00.000Z"),
        completedAt: new Date("2026-11-08T08:27:00.000Z"),
      },
    });
    const monthly = await api("manager").get("/reports?month=2026-11");
    expect(monthly.status).toBe(200);
    expect(monthly.body.month).toBe("2026-11");
    expect(monthly.body.totals).toEqual({ scheduled: 2, pending: 1, inProgress: 0, completed: 0, verified: 1, cancelled: 0, estimatedCompletedMinutes: 30, trackedElapsedMinutes: 27, timedTaskCount: 1 });
    expect(monthly.body.employees).toEqual([expect.objectContaining({ employeeId: people.cleaner, employeeName: "cleaner", scheduled: 2, pending: 1, verified: 1, estimatedCompletedMinutes: 30, trackedElapsedMinutes: 27, timedTaskCount: 1 })]);
    const audit = await api("manager").get("/audit");
    expect(audit.status).toBe(200);
    expect(
      audit.body.every(
        (x: { propertyId: string }) => x.propertyId === properties[0],
      ),
    ).toBe(true);
    const dashboard = await api("front").get("/dashboard?date=" + day);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.openMaintenance).toBe(0);
    expect(dashboard.body.overdue).toEqual({
      cleaning: 0,
      frontDesk: 0,
      maintenance: 0,
      total: 0,
    });
    expect(Array.isArray(dashboard.body.cleaning)).toBe(true);
  });
  it("does not leak password hashes in employee responses", async () => {
    const r = await api("front").get("/employees");
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain("passwordHash");
    expect(r.body.some((x: { id: string }) => x.id === people.foreign)).toBe(
      false,
    );
  });
  it("revokes a property membership and denies subsequent API access", async () => {
    const membership = await prisma.propertyMembership.findFirstOrThrow({
      where: { propertyId: properties[0], userId: people.otherCleaner },
    });
    expect(
      (
        await api("manager").patch("/employees/" + membership.id, {
          isActive: false,
        })
      ).status,
    ).toBe(200);
    expect((await api("otherCleaner").get("/rooms")).status).toBe(401);
  });
});

it('returns a failed inspection for rework only with a supervisor reason and preserves the original elapsed-time start', async () => {
  const testRoom = await prisma.room.create({ data: { propertyId: properties[0], number: 'REWORK', floor: 1, status: 'INSPECTION' } });
  const startedAt = new Date('2026-11-06T08:00:00Z');
  const task = await prisma.cleaningTask.create({ data: { propertyId: properties[0], roomId: testRoom.id, createdById: people.manager, assignedToId: people.cleaner, cleaningType: 'CHECKOUT', scheduledFor: new Date(day), status: 'COMPLETED', startedAt, completedAt: new Date('2026-11-06T08:30:00Z') } });
  expect((await api('cleaner').patch('/housekeeping/'+task.id, { status: 'IN_PROGRESS', reworkReason: 'Not permitted' })).status).toBe(403);
  expect((await api('manager').patch('/housekeeping/'+task.id, { status: 'IN_PROGRESS' })).status).toBe(400);
  const returned = await api('manager').patch('/housekeeping/'+task.id, { status: 'IN_PROGRESS', reworkReason: 'Recheck bathroom fixtures' });
  expect(returned.status).toBe(200); expect(returned.body.completedAt).toBeNull(); expect(returned.body.startedAt).toBe(startedAt.toISOString()); expect(returned.body.instructions).toContain('Recheck bathroom fixtures');
  expect(await prisma.notification.count({ where: { userId: people.cleaner, entityId: task.id, type: 'ROOM_INSPECTION' } })).toBe(1);
  expect((await api('cleaner').patch('/housekeeping/'+task.id, { status: 'COMPLETED' })).status).toBe(200);
  expect((await api('manager').patch('/housekeeping/'+task.id, { status: 'VERIFIED' })).status).toBe(200);
  expect((await prisma.room.findUniqueOrThrow({ where: { id: testRoom.id } })).status).toBe('CLEAN');
});
