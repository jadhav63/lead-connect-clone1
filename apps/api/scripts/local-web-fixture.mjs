import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import argon2 from "argon2";
import { assertTestDatabase } from "./test-database.mjs";
assertTestDatabase(process.env.DATABASE_URL);
const path = process.env.LOCAL_UI_FIXTURE_FILE;
if (!path || !path.startsWith("/tmp/lead-connect-"))
  throw new Error("Use a private temporary fixture path");
const { prisma } = await import("../dist/lib/db.js");
try {
  if (process.argv.includes("--cleanup")) {
    const f = JSON.parse(readFileSync(path, "utf8"));
    const scope = { propertyId: f.propertyId };
    const rooms = (
      await prisma.room.findMany({ where: scope, select: { id: true } })
    ).map((x) => x.id);
    const tickets = (
      await prisma.maintenanceTicket.findMany({
        where: scope,
        select: { id: true },
      })
    ).map((x) => x.id);
    const users = (
      await prisma.propertyMembership.findMany({
        where: scope,
        select: { userId: true },
      })
    ).map((x) => x.userId);
    await prisma.ticketEvent.deleteMany({
      where: { ticketId: { in: tickets } },
    });
    await prisma.roomStatusEvent.deleteMany({
      where: { roomId: { in: rooms } },
    });
    await prisma.frontDeskTask.deleteMany({ where: scope });
    await prisma.shiftHandover.deleteMany({ where: scope });
    await prisma.cleaningTask.deleteMany({ where: scope });
    await prisma.maintenanceTicket.deleteMany({ where: scope });
    await prisma.staffDirectoryEntry.deleteMany({ where: scope });
    await prisma.auditLog.deleteMany({ where: scope });
    await prisma.notification.deleteMany({ where: scope });
    await prisma.refreshToken.deleteMany({ where: scope });
    await prisma.room.deleteMany({ where: scope });
    await prisma.propertyMembership.deleteMany({ where: scope });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.property.delete({ where: { id: f.propertyId } });
    unlinkSync(path);
  } else {
    const password = randomBytes(32).toString("hex");
    const passwordHash = await argon2.hash(password);
    const code = "UI-" + randomUUID();
    const property = await prisma.property.create({
      data: { name: "Fictional UI Test Hotel", code },
    });
    const admin = await prisma.user.create({
      data: {
        name: "Fictional Test Manager",
        email: randomUUID() + "@example.test",
        passwordHash,
        memberships: { create: { propertyId: property.id, role: "MANAGER" } },
      },
    });
    const cleanerPassword = randomBytes(32).toString("hex");
    const cleaner = await prisma.user.create({
      data: {
        name: "Fictional Housekeeper",
        email: randomUUID() + "@example.test",
        passwordHash: await argon2.hash(cleanerPassword),
        memberships: {
          create: { propertyId: property.id, role: "HOUSEKEEPING" },
        },
      },
    });
    const technicianPassword = randomBytes(32).toString("hex");
    const technician = await prisma.user.create({ data: { name: "Test Technician", email: randomUUID()+"@example.test", passwordHash: await argon2.hash(technicianPassword), memberships: { create: { propertyId: property.id, role: "MAINTENANCE" } } } });
    const frontDeskPassword = randomBytes(32).toString("hex");
    const frontDesk = await prisma.user.create({ data: { name: "Test Front Desk", email: randomUUID()+"@example.test", passwordHash: await argon2.hash(frontDeskPassword), memberships: { create: { propertyId: property.id, role: "FRONT_DESK" } } } });
    await prisma.room.createMany({ data: Array.from({length:59}, (_,i)=>({ propertyId:property.id, number:String(902+i), floor:2, status:"CLEAN", occupancyStatus:"VACANT" })) });
    const room = await prisma.room.create({
      data: {
        propertyId: property.id,
        number: "901",
        floor: 1,
        status: "DIRTY",
        occupancyStatus: "DEPARTURE",
        notes: "Persistent fictional note",
      },
    });
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Phoenix",
    }).format(new Date());
    await prisma.cleaningTask.create({
      data: {
        propertyId: property.id,
        roomId: room.id,
        createdById: admin.id,
        scheduledFor: new Date(day),
        cleaningType: "CHECKOUT",
      },
    });
    writeFileSync(
      path,
      JSON.stringify({
        propertyId: property.id,
        email: admin.email,
        password,
        code,
        cleanerId: cleaner.id,
        cleanerEmail: cleaner.email, cleanerPassword,
        technicianId: technician.id, technicianEmail: technician.email, technicianPassword,
        frontDeskId: frontDesk.id, frontDeskEmail: frontDesk.email, frontDeskPassword, roomId: room.id,
      }),
      { mode: 0o600 },
    );
  }
  console.log("Disposable local UI fixture operation completed.");
} finally {
  await prisma.$disconnect();
}
