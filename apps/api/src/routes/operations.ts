Warning: truncated output (original token count: 8900)
Total output lines: 1036

import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { NotificationType, UserRole } from "../generated/prisma/enums.js";
import { elapsedCleaningMinutes, estimatedCleaningMinutes } from "../services/cleaning-time.js";

const router = Router();
router.use(requireAuth);
const management = requireRole("ADMIN", "MANAGER");
const frontDesk = requireRole("ADMIN", "MANAGER", "FRONT_DESK");
const id = z.uuid();
const text = z.string().trim().min(1).max(2000);
const date = z.iso.date().transform((s) => new Date(`${s}T00:00:00.000Z`));
const shift = z.enum(["A", "B", "C"]);
const userSelect = { id: true, name: true, email: true } as const;
const roomStatuses = [
  "CLEAN",
  "DIRTY",
  "IN_PROGRESS",
  "INSPECTION",
  "MAINTENANCE",
  "OUT_OF_ORDER",
] as const;
const occupancies = ["VACANT", "OCCUPIED", "ARRIVAL", "DEPARTURE"] as const;
const cleaningTypes = [
  "CHECKOUT",
  "STAYOVER",
  "FULL_SERVICE",
  "DEEP_CLEAN",
  "ARRIVAL_TOUCHUP",
] as const;
const statuses = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
  "CANCELLED",
] as const;
const serial = { isolationLevel: "Serializable" as const };
type Tx = Prisma.TransactionClient;
function auth(req: Request) {
  return req.auth!;
}
function manager(req: Request) {
  return auth(req).roles.some((r) => ["ADMIN", "MANAGER"].includes(r));
}
function businessDate(req: Request) {
  const value =
    req.query.date ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(
      new Date(),
    );
  return date.parse(value);
}
async function member(
  tx: Tx,
  propertyId: string,
  userId: string | null | undefined,
  roles?: UserRole[],
) {
  if (!userId) return;
  const found = await tx.propertyMembership.findFirst({
    where: {
      propertyId,
      userId,
      isActive: true,
      ...(roles ? { role: { in: roles } } : {}),
      user: { isActive: true, deletedAt: null },
    },
  });
  if (!found)
    throw new HttpError(
      400,
      "Assignee must be an active member with the required role",
    );
}
async function room(tx: Tx, propertyId: string, roomId: string) {
  const found = await tx.room.findFirst({
    where: { id: roomId, propertyId, isActive: true },
  });
  if (!found) throw new HttpError(404, "Room not found");
  return found;
}
async function audit(
  tx: Tx,
  req: Request,
  entityType: string,
  entityId: string,
  action: "CREATE" | "UPDATE" | "ASSIGN" | "STATUS_CHANGE",
) {
  await tx.auditLog.create({
    data: {
      propertyId: auth(req).propertyId,
      actorId: auth(req).userId,
      entityType,
      entityId,
      action,
    },
  });
}
async function notifyUsers(
  tx: Tx,
  propertyId: string,
  userIds: Array<string | null | undefined>,
  type: NotificationType,
  title: string,
  message: string,
  entityId: string,
) {
  const recipients = [...new Set(userIds.filter((value): value is string => Boolean(value)))];
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((userId) => ({ propertyId, userId, type, title, message, entityId })),
  });
}
async function notifyRoles(
  tx: Tx,
  propertyId: string,
  roles: UserRole[],
  type: NotificationType,
  title: string,
  message: string,
  entityId: string,
) {
  const memberships = await tx.propertyMembership.findMany({
    where: {
      propertyId,
      isActive: true,
      role: { in: roles },
      user: { isActive: true, deletedAt: null },
    },
    select: { userId: true },
  });
  await notifyUsers(tx, propertyId, memberships.map((item) => item.userId), type, title, message, entityId);
}
async function roomState(
  tx: Tx,
  req: Request,
  roomId: string,
  status: (typeof roomStatuses)[number],
) {
  const current = await room(tx, auth(req).propertyId, roomId);
  if (current.status === status) return;
  await tx.room.update({
    where: { id: roomId },
    data: { status, version: { increment: 1 } },
  });
  await tx.roomStatusEvent.create({
    data: {
      roomId,
      actorId: auth(req).userId,
      fromStatus: current.status,
      toStatus: status,
    },
  });
}

router.get("/properties/current", async (req, res) => {
  res.json(
    await prisma.property.findUniqueOrThrow({
      where: { id: auth(req).propertyId },
    }),
  );
});
router.patch("/properties/current", management, async (req, res) => {
  const data = z
    .object({
      name: text.optional(),
      address: z.string().max(500).nullable().optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id: auth(req).propertyId },
        data,
      });
      await audit(tx, req, "Property", updated.id, "UPDATE");
      return updated;
    }),
  );
});
router.get("/employees", frontDesk, async (req, res) => {
  const rows = await prisma.propertyMembership.findMany({
    where: { propertyId: auth(req).propertyId },
    include: { user: { select: { ...userSelect, isActive: true } } },
    orderBy: { user: { name: "asc" } },
  });
  res.json(
    rows.map(({ user, role, isActive, id }) => ({
      ...user,
      role,
      membershipActive: isActive,
      membershipId: id,
    })),
  );
});
router.patch("/employees/:membershipId", management, async (req, res) => {
  const membershipId = id.parse(req.params.membershipId);
  const data = z.object({ isActive: z.boolean() }).strict().parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const current = await tx.propertyMembership.findFirst({
        where: { id: membershipId, propertyId: auth(req).propertyId },
      });
      if (!current) throw new HttpError(404, "Membership not found");
      if (
        current.userId === auth(req).userId ||
        (current.role === "ADMIN" && !auth(req).roles.includes("ADMIN"))
      )
        throw new HttpError(403, "Cannot change this membership");
      await tx.propertyMembership.update({ where: { id: membershipId }, data });
      if (!data.isActive)
        await tx.refreshToken.updateMany({
          where: {
            userId: current.userId,
            propertyId: current.propertyId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      await audit(tx, req, "PropertyMembership", membershipId, "UPDATE");
      return { id: membershipId, ...data };
    }, serial),
  );
});

router.get("/rooms", async (req, res) => {
  const query = z
    .object({
      search: z.string().max(100).optional(),
      status: z.enum(roomStatuses).optional(),
      occupancyStatus: z.enum(occupancies).optional(),
      floor: z.coerce.number().int().optional(),
    })
    .parse(req.query);
  res.json(
    await prisma.room.findMany({
      where: {
        propertyId: auth(req).propertyId,
        isActive: true,
        ...(query.search
          ? { number: { contains: query.search, mode: "insensitive" } }
          : {}),
        status: query.status,
        occupancyStatus: query.occupancyStatus,
        floor: query.floor,
      },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    }),
  );
});
router.post("/rooms", frontDesk, async (req, res) => {
  const data = z
    .object({
      number: z.string().trim().min(1).max(20),
      floor: z.number().int().min(0).max(100),
      roomType: z.string().max(100).optional(),
      status: z.enum(roomStatuses).optional(),
      occupancyStatus: z.enum(occupancies).optional(),
      notes: z.string().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  res.status(201).json(
    await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: { ...data, propertyId: auth(req).propertyId },
      });
      await audit(tx, req, "Room", created.id, "CREATE");
      return created;
    }),
  );
});
router.patch("/rooms/:roomId", frontDesk, async (req, res) => {
  const roomId = id.parse(req.params.roomId);
  const { version, ...data } = z
    .object({
      version: z.number().int().positive(),
      status: z.enum(roomStatuses).optional(),
      occupancyStatus: z.enum(occupancies).optional(),
      notes: z.string().max(2000).nullable().optional(),
      roomType: z.string().max(100).nullable().optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const current = await room(tx, auth(req).propertyId, roomId);
      const updated = await tx.room.updateMany({
        where: { id: roomId, propertyId: auth(req).propertyId, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new HttpError(409, "Room changed; reload before saving");
      if (data.status && data.status !== current.status)
        await tx.roomStatusEvent.create({
          data: {
            roomId,
            actorId: auth(req).userId,
            fromStatus: current.status,
            toStatus: data.status,
          },
        });
      await audit(tx, req, "Room", roomId, "UPDATE");
      return tx.room.findUniqueOrThrow({ where: { id: roomId } });
    }, serial),
  );
});
router.get("/rooms/:roomId/history", async (req, res) => {
  const roomId = id.parse(req.params.roomId);
  await room(prisma, auth(req).propertyId, roomId);
  res.json(
    await prisma.roomStatusEvent.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, name: true } } },
    }),
  );
});

const assignment = z
  .object({
    roomId: id,
    assignedToId: id.nullable().optional(),
    cleaningType: z.enum(cleaningTypes),
    scheduledFor: date,
    instructions: z.string().max(2000).optional(),
  })
  .strict();
router.get("/housekeeping", async (req, res) => {
  res.json(
    await prisma.cleaningTask.findMany({
      where: {
        propertyId: auth(req).propertyId,
        scheduledFor: businessDate(req),
        ...(!manager(req) && !auth(req).roles.includes("FRONT_DESK")
          ? { assignedToId: auth(req).userId }
          : {}),
      },
      include: { room: true, assignedTo: { select: userSelect } },
      orderBy: [{ room: { floor: "asc" } }, { room: { number: "asc" } }],
    }),
  );
});
async function createAssignment(
  tx: Tx,
  req: Request,
  data: z.output<typeof assignment>,
) {
  const assignedRoom = await room(tx, auth(req).propertyId, data.roomId);
  await member(tx, auth(req).propertyId, data.assignedToId, ["HOUSEKEEPING"]);
  const existing = await tx.cleaningTask.findFirst({
    where: {
      propertyId: auth(req).propertyId,
      roomId: data.roomId,
      scheduledFor: data.scheduledFor,
      status: { not: "CANCELLED" },
    },
  });
  if (existing)
    throw new HttpError(409, "Room already has a cleaning task for this date");
  const created = await tx.cleaningTask.create({
    data: {
      ...data,
      propertyId: auth(req).propertyId,
      createdById: auth(req).userId,
    },
  });
  await audit(tx, req, "CleaningTask", created.id, "CREATE");
  await notifyUsers(
    tx,
    auth(req).propertyId,
    [created.assignedToId],
    "TASK_ASSIGNED",
    "Cleaning assignment",
    `Room ${assignedRoom.number} was assigned to you.`,
    created.id,
  );
  return created;
}
router.post("/housekeeping", frontDesk, async (req, res) => {
  const data = assignment.parse(req.body);
  res
    .status(201)
    .json(
      await prisma.$transaction(
        (tx) => createAssignment(tx, req, data),
        serial,
      ),
    );
});
router.post("/housekeeping/import", frontDesk, async (req, res) => {
  const data = z
    .object({
      date,
      rows: z
        .array(
          z
            .object({
              roomNumber: z.string().min(1).max(20),
              occupancyStatus: z.enum(occupancies),
              cleaningType: z.enum(cleaningTypes).optional(),
              assignedToId: id.nullable().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(200),
    })
    .strict()
    .parse(req.body);
  if (new Set(data.rows.map((r) => r.roomNumber)).size !== data.rows.length)
    throw new HttpError(400, "Duplicate room numbers");
  res.json(
    await prisma.$transaction(
      async (tx) => {
        for (const row of data.rows) {
          const found = await tx.room.findFirst({
            where: {
              number: row.roomNumber,
              propertyId: auth(req).propertyId,
              isActive: true,
            },
          });
          if (!found)
            throw new HttpError(404, `Room ${row.roomNumber} not found`);
          await tx.room.update({
            where: { id: found.id },
            data: {
              occupancyStatus: row.occupancyStatus,
              version: { increment: 1 },
            },
          });
          await audit(tx, req, "Room", found.id, "UPDATE");
          if (row.cleaningType)
            await createAssignment(tx, req, {
              roomId: found.id,
              assignedToId: row.assignedToId,
              cleaningType: row.cleaningType,
              scheduledFor: data.date,
            });
        }
        return { imported: data.rows.length };
      },
      { ...serial, timeout: 30000 },
    ),
  );
});
router.patch("/housekeeping/:taskId", async (req, res) => {
  const taskId = id.parse(req.params.taskId);
  const data = z
    .object({
      assignedToId: id.nullable().optional(),
      status: z.enum(statuses).optional(),
      instructions: z.string().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId: auth(req).propertyId },
      });
      if (!task) throw new HttpError(40…1900 tokens truncated…nt, ...changes } = data;
      const updated = await tx.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          ...changes,
          ...(data.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
          ...(data.status === "CLOSED" ? { closedAt: new Date() } : {}),
          ...(data.status === "OPEN"
            ? { closedAt: null, resolution: null, startedAt: null }
            : {}),
        },
      });
      await tx.ticketEvent.create({
        data: {
          ticketId,
          actorId: auth(req).userId,
          fromStatus: ticket.status,
          toStatus: data.status,
          comment,
        },
      });
      await audit(
        tx,
        req,
        "MaintenanceTicket",
        ticketId,
        data.status ? "STATUS_CHANGE" : "UPDATE",
      );
      const changedAssignee = data.assignedToId !== undefined && data.assignedToId !== ticket.assignedToId;
      if (changedAssignee && data.assignedToId)
        await notifyUsers(tx, auth(req).propertyId, [data.assignedToId], "TICKET_ASSIGNED", "Maintenance ticket assigned", "A maintenance ticket was assigned to you.", ticketId);
      if ((data.status || data.priority !== undefined || data.resolution !== undefined)
          && ticket.reportedById !== auth(req).userId)
        await notifyUsers(tx, auth(req).propertyId, [ticket.reportedById], "MAINTENANCE_UPDATED", "Maintenance request updated", "A maintenance request you reported was updated.", ticketId);
      return updated;
    }, serial),
  );
});

router.get("/front-desk/tasks", frontDesk, async (req, res) => {
  res.json(
    await prisma.frontDeskTask.findMany({
      where: {
        propertyId: auth(req).propertyId,
        scheduledFor: businessDate(req),
      },
      include: { room: true, assignedTo: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    }),
  );
});
router.post("/front-desk/tasks", frontDesk, async (req, res) => {
  const data = z
    .object({
      title: z.string().trim().min(1).max(200),
      kind: z.enum(["CHECKLIST", "INSPECTION", "OTHER"]).default("CHECKLIST"),
      shift,
      scheduledFor: date,
      roomId: id.nullable().optional(),
      assignedToId: id.nullable().optional(),
      notes: z.string().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  if (data.kind === "INSPECTION" && !data.roomId)
    throw new HttpError(400, "Inspection requires a room");
  res.status(201).json(
    await prisma.$transaction(async (tx) => {
      if (data.roomId) await room(tx, auth(req).propertyId, data.roomId);
      await member(tx, auth(req).propertyId, data.assignedToId, [
        "ADMIN",
        "MANAGER",
        "FRONT_DESK",
      ]);
      const task = await tx.frontDeskTask.create({
        data: {
          ...data,
          propertyId: auth(req).propertyId,
          createdById: auth(req).userId,
        },
      });
      await audit(tx, req, "FrontDeskTask", task.id, "CREATE");
      await notifyUsers(tx, auth(req).propertyId, [task.assignedToId], "TASK_ASSIGNED", "Front desk task", "A front desk task was assigned to you.", task.id);
      return task;
    }, serial),
  );
});
router.patch("/front-desk/tasks/:taskId", frontDesk, async (req, res) => {
  const taskId = id.parse(req.params.taskId);
  const data = z
    .object({
      status: z.enum(["IN_PROGRESS", "COMPLETED", "VERIFIED", "CANCELLED"]),
      notes: z.string().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const task = await tx.frontDeskTask.findFirst({
        where: { id: taskId, propertyId: auth(req).propertyId },
      });
      if (!task) throw new HttpError(404, "Task not found");
      if (
        !manager(req) &&
        task.assignedToId &&
        task.assignedToId !== auth(req).userId
      )
        throw new HttpError(403, "Forbidden");
      const allowed: Record<string, string[]> = {
        PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
        IN_PROGRESS: ["COMPLETED", "CANCELLED"],
        COMPLETED: ["VERIFIED"],
        VERIFIED: [],
        CANCELLED: [],
      };
      if (!allowed[task.status].includes(data.status))
        throw new HttpError(409, "Invalid task transition");
      if (["VERIFIED", "CANCELLED"].includes(data.status) && !manager(req))
        throw new HttpError(403, "Supervisor required");
      const updated = await tx.frontDeskTask.update({
        where: { id: taskId },
        data: {
          ...data,
          ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
          ...(data.status === "VERIFIED"
            ? { verifiedAt: new Date(), verifiedById: auth(req).userId }
            : {}),
        },
      });
      await audit(tx, req, "FrontDeskTask", taskId, "STATUS_CHANGE");
      return updated;
    }, serial),
  );
});
router.get("/front-desk/handovers", frontDesk, async (req, res) => {
  res.json(
    await prisma.shiftHandover.findMany({
      where: {
        propertyId: auth(req).propertyId,
        businessDate: businessDate(req),
      },
      include: {
        author: { select: userSelect },
        verifiedBy: { select: userSelect },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
});
router.post("/front-desk/handovers", frontDesk, async (req, res) => {
  const data = z
    .object({ shift, businessDate: date, notes: text })
    .strict()
    .parse(req.body);
  res.status(201).json(
    await prisma.$transaction(async (tx) => {
      const created = await tx.shiftHandover.create({
        data: {
          ...data,
          propertyId: auth(req).propertyId,
          authorId: auth(req).userId,
        },
      });
      await audit(tx, req, "ShiftHandover", created.id, "CREATE");
      return created;
    }),
  );
});
router.post(
  "/front-desk/handovers/:handoverId/verify",
  frontDesk,
  async (req, res) => {
    const handoverId = id.parse(req.params.handoverId);
    res.json(
      await prisma.$transaction(async (tx) => {
        const found = await tx.shiftHandover.findFirst({
          where: { id: handoverId, propertyId: auth(req).propertyId },
        });
        if (!found) throw new HttpError(404, "Handover not found");
        if (found.authorId === auth(req).userId)
          throw new HttpError(403, "Incoming shift must verify the handover");
        if (found.verifiedAt) throw new HttpError(409, "Already verified");
        const updated = await tx.shiftHandover.update({
          where: { id: handoverId },
          data: { verifiedById: auth(req).userId, verifiedAt: new Date() },
        });
        await audit(tx, req, "ShiftHandover", handoverId, "UPDATE");
        return updated;
      }, serial),
    );
  },
);

router.get("/dashboard", async (req, res) => {
  const propertyId = auth(req).propertyId;
  const day = businessDate(req);
  const [rooms, cleaning, tickets, frontDeskTasks, handovers, overdueCleaning, overdueFrontDesk, overdueMaintenance] =
    await prisma.$transaction([
      prisma.room.groupBy({
        by: ["status", "occupancyStatus"],
        orderBy: { status: "asc" },
        where: { propertyId, isActive: true },
        _count: true,
      }),
      prisma.cleaningTask.groupBy({
        by: ["status"],
        orderBy: { status: "asc" },
        where: { propertyId, scheduledFor: day },
        _count: true,
      }),
      prisma.maintenanceTicket.count({
        where: { propertyId, status: { not: "CLOSED" } },
      }),
      prisma.frontDeskTask.count({
        where: {
          propertyId,
          scheduledFor: day,
          status: { notIn: ["VERIFIED", "CANCELLED"] },
        },
      }),
      prisma.shiftHandover.count({
        where: { propertyId, businessDate: day, verifiedAt: null },
      }),
      prisma.cleaningTask.count({
        where: { propertyId, scheduledFor: { lt: day }, status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
      }),
      prisma.frontDeskTask.count({
        where: { propertyId, scheduledFor: { lt: day }, status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
      }),
      prisma.maintenanceTicket.count({
        where: { propertyId, status: { not: "CLOSED" }, dueAt: { lt: new Date(`${day.toISOString().slice(0, 10)}T00:00:00.000Z`) } },
      }),
    ]);
  res.json({
    date: day,
    rooms,
    cleaning,
    openMaintenance: tickets,
    unverifiedFrontDeskTasks: frontDeskTasks,
    unverifiedHandovers: handovers,
    overdue: {
      cleaning: overdueCleaning,
      frontDesk: overdueFrontDesk,
      maintenance: overdueMaintenance,
      total: overdueCleaning + overdueFrontDesk + overdueMaintenance,
    },
  });
});
router.get("/reports", management, async (req, res) => {
  if (req.query.month !== undefined) {
    if (req.query.date !== undefined)
      throw new HttpError(400, "Choose either a report date or month");
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 1));
    const where = {
      propertyId: auth(req).propertyId,
      scheduledFor: { gte: start, lt: end },
    };
    const monthlyTasks = await prisma.cleaningTask.findMany({
      where,
      select: {
        assignedToId: true,
        status: true,
        cleaningType: true,
        startedAt: true,
        completedAt: true,
      },
    });
    const assignedIds = [...new Set(monthlyTasks.flatMap((task) => task.assignedToId ? [task.assignedToId] : []))];
    const people = assignedIds.length
      ? await prisma.user.findMany({ where: { id: { in: assignedIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(people.map((person) => [person.id, person.name]));
    const totals = { scheduled: 0, pending: 0, inProgress: 0, completed: 0, verified: 0, cancelled: 0, estimatedCompletedMinutes: 0, trackedElapsedMinutes: 0, timedTaskCount: 0 };
    const employeeRows = new Map<string, { employeeId: string | null; employeeName: string; scheduled: number; pending: number; inProgress: number; completed: number; verified: number; cancelled: number; estimatedCompletedMinutes: number; trackedElapsedMinutes: number; timedTaskCount: number }>();
    for (const task of monthlyTasks) {
      totals.scheduled += 1;
      const key = task.assignedToId ?? "unassigned";
      const employee = employeeRows.get(key) ?? {
        employeeId: task.assignedToId,
        employeeName: task.assignedToId ? names.get(task.assignedToId) ?? "Former employee" : "Unassigned",
        scheduled: 0, pending: 0, inProgress: 0, completed: 0, verified: 0, cancelled: 0,
        estimatedCompletedMinutes: 0, trackedElapsedMinutes: 0, timedTaskCount: 0,
      };
      employee.scheduled += 1;
      if (task.status === "PENDING") { totals.pending += 1; employee.pending += 1; }
      if (task.status === "IN_PROGRESS") { totals.inProgress += 1; employee.inProgress += 1; }
      if (task.status === "COMPLETED") { totals.completed += 1; employee.completed += 1; }
      if (task.status === "VERIFIED") { totals.verified += 1; employee.verified += 1; }
      if (task.status === "CANCELLED") { totals.cancelled += 1; employee.cancelled += 1; }
      if (task.status === "COMPLETED" || task.status === "VERIFIED") {
        const estimate = estimatedCleaningMinutes(task.cleaningType);
        const elapsed = elapsedCleaningMinutes(task.startedAt, task.completedAt);
        totals.estimatedCompletedMinutes += estimate;
        employee.estimatedCompletedMinutes += estimate;
        if (elapsed !== null) {
          totals.trackedElapsedMinutes += elapsed;
          employee.trackedElapsedMinutes += elapsed;
          totals.timedTaskCount += 1;
          employee.timedTaskCount += 1;
        }
      }
      employeeRows.set(key, employee);
    }
    res.json({ month, totals, employees: [...employeeRows.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName)) });
    return;
  }
  const day = businessDate(req);
  const tasks = await prisma.cleaningTask.findMany({
    where: { propertyId: auth(req).propertyId, scheduledFor: day },
    include: {
      assignedTo: { select: { id: true, name: true } },
      room: { select: { number: true } },
    },
    orderBy: { room: { number: "asc" } },
  });
  res.json({
    date: day,
    cleaningTasks: tasks,
    completed: tasks.filter((t) => ["COMPLETED", "VERIFIED"].includes(t.status))
      .length,
    verified: tasks.filter((t) => t.status === "VERIFIED").length,
  });
});
router.get("/audit", management, async (req, res) => {
  res.json(
    await prisma.auditLog.findMany({
      where: { propertyId: auth(req).propertyId },
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    }),
  );
});
router.get("/notifications", async (req, res) => {
  const unreadOnly = req.query.unreadOnly === undefined
    ? false
    : z.enum(["true", "false"]).parse(req.query.unreadOnly) === "true";
  res.json(await prisma.notification.findMany({
    where: {
      propertyId: auth(req).propertyId,
      userId: auth(req).userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  }));
});
router.patch("/notifications/:notificationId/read", async (req, res) => {
  z.object({}).strict().parse(req.body);
  const notificationId = id.parse(req.params.notificationId);
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      propertyId: auth(req).propertyId,
      userId: auth(req).userId,
    },
  });
  if (!notification) throw new HttpError(404, "Notification not found");
  if (notification.isRead) return res.json(notification);
  res.json(await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  }));
});
export default router;
