import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { HttpError } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { NotificationType, UserRole } from "../generated/prisma/enums.js";
import { elapsedCleaningMinutes, estimatedCleaningMinutes } from "../services/cleaning-time.js";
import { revokeEmployeeSessions } from '../services/employee-access.js';

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
  "UNKNOWN",
] as const;
const occupancies = ["VACANT", "OCCUPIED", "ARRIVAL", "DEPARTURE", "UNKNOWN"] as const;
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
      const linkedProfile=await tx.staffDirectoryEntry.findFirst({where:{propertyId:current.propertyId,userId:current.userId}});
      if(data.isActive && linkedProfile && (!linkedProfile.appAccessEnabled || linkedProfile.employmentStatus!=='ACTIVE'))throw new HttpError(409,'Issue a fresh activation code for this approved staff profile');
      if (
        current.userId === auth(req).userId ||
        (["ADMIN","MANAGER"].includes(current.role) && !auth(req).roles.includes("ADMIN"))
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
      if (!data.isActive) {
        await revokeEmployeeSessions(tx,current.userId);
        // Deactivation removes every role for this property, including linked profiles.
        await tx.propertyMembership.updateMany({where:{propertyId:current.propertyId,userId:current.userId},data:{isActive:false}});
        await tx.staffDirectoryEntry.updateMany({where:{propertyId:current.propertyId,userId:current.userId},data:{appAccessEnabled:false}});
      }
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
      const property = await tx.property.findUniqueOrThrow({ where: { id: auth(req).propertyId }, select: { code: true } });
      if (property.code === '58835') throw new HttpError(403, 'Use the independently approved 60-room inventory workflow for this hotel; manual room creation is disabled');
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
      floor: z.number().int().min(1).max(2).optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const current = await room(tx, auth(req).propertyId, roomId);
      if ((data.roomType !== undefined && data.roomType !== current.roomType) || (data.floor !== undefined && data.floor !== current.floor)) {
        const property = await tx.property.findUniqueOrThrow({ where: { id: auth(req).propertyId }, select: { code: true } });
        if (property.code === '58835') throw new HttpError(403, 'Approved hotel room types, accessibility codes and floors require a separately reviewed inventory change');
      }
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
router.get("/housekeeping/overdue", async (req, res) => {
  const before = date.parse(req.query.before);
  res.json(
    await prisma.cleaningTask.findMany({
      where: {
        propertyId: auth(req).propertyId,
        scheduledFor: { lt: before },
        status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
        ...(!manager(req) && !auth(req).roles.includes("FRONT_DESK")
          ? { assignedToId: auth(req).userId }
          : {}),
      },
      include: { room: true, assignedTo: { select: userSelect } },
      orderBy: [{ scheduledFor: "asc" }, { room: { floor: "asc" } }, { room: { number: "asc" } }],
      take: 500,
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
      reworkReason: z.string().trim().min(1).max(1000).optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId: auth(req).propertyId },
      });
      if (!task) throw new HttpError(404, "Cleaning task not found");
      const supervisor = manager(req) || auth(req).roles.includes("FRONT_DESK");
      if (
        !supervisor &&
        (!auth(req).roles.includes("HOUSEKEEPING") ||
          task.assignedToId !== auth(req).userId ||
          data.assignedToId !== undefined ||
          data.instructions !== undefined)
      )
        throw new HttpError(403, "Forbidden");
      if (
        ["COMPLETED", "VERIFIED", "CANCELLED"].includes(task.status) &&
        data.assignedToId !== undefined
      )
        throw new HttpError(409, "Completed tasks cannot be reassigned");
      await member(tx, auth(req).propertyId, data.assignedToId, [
        "HOUSEKEEPING",
      ]);
      const taskRoom = await room(tx, auth(req).propertyId, task.roomId);
      const reassigned=data.assignedToId!==undefined && data.assignedToId!==task.assignedToId && task.status==='IN_PROGRESS';
      if(reassigned && data.status!==undefined)throw new HttpError(400,'Reassign separately from changing task status');
      if(reassigned && !['MAINTENANCE','OUT_OF_ORDER'].includes(taskRoom.status))await roomState(tx,req,task.roomId,'DIRTY');
      const rework = task.status === "COMPLETED" && data.status === "IN_PROGRESS";
      if (data.reworkReason !== undefined && !rework) throw new HttpError(400, "Rework reason requires a completed inspection");
      if (rework && !supervisor) throw new HttpError(403, "Supervisor required");
      if (rework && !data.reworkReason) throw new HttpError(400, "Inspection rework reason required");
      if (data.status) {
        const allowed: Record<string, string[]> = {
          PENDING: ["IN_PROGRESS", "CANCELLED"],
          IN_PROGRESS: ["COMPLETED", "CANCELLED"],
          COMPLETED: ["VERIFIED", "IN_PROGRESS"],
          VERIFIED: [],
          CANCELLED: [],
        };
        if (!allowed[task.status].includes(data.status))
          throw new HttpError(409, "Invalid cleaning transition");
        if (["VERIFIED", "CANCELLED"].includes(data.status) && !supervisor)
          throw new HttpError(403, "Supervisor required");
        if (
          ["MAINTENANCE", "OUT_OF_ORDER"].includes(taskRoom.status) &&
          data.status !== "CANCELLED"
        )
          throw new HttpError(409, "Room is unavailable for cleaning");
        if (data.status === "IN_PROGRESS")
          await roomState(tx, req, task.roomId, "IN_PROGRESS");
        if (data.status === "COMPLETED")
          await roomState(tx, req, task.roomId, "INSPECTION");
        if (data.status === "VERIFIED")
          await roomState(tx, req, task.roomId, "CLEAN");
        if (data.status === "CANCELLED" && task.status === "IN_PROGRESS")
          await roomState(tx, req, task.roomId, "DIRTY");
      }
      const { reworkReason, ...changes } = data;
      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: {
          ...changes,
          ...(reassigned?{status:'PENDING',startedAt:null,completedAt:null,verifiedAt:null,verifiedById:null}:{}),
          ...(data.status === "IN_PROGRESS" ? { startedAt: task.startedAt ?? new Date() } : {}),
          ...(rework ? { completedAt: null, verifiedAt: null, verifiedById: null,
            instructions: [task.instructions, `Inspection rework: ${reworkReason}`].filter(Boolean).join('\n').slice(-2000) } : {}),
          ...(data.status === "COMPLETED" ? { completedAt: new Date() } : {}),
          ...(data.status === "VERIFIED"
            ? { verifiedAt: new Date(), verifiedById: auth(req).userId }
            : {}),
        },
      });
      await audit(
        tx,
        req,
        "CleaningTask",
        taskId,
        data.status ? "STATUS_CHANGE" : "ASSIGN",
      );
      if (data.status === "COMPLETED" && task.status !== "COMPLETED")
        await notifyRoles(
          tx,
          auth(req).propertyId,
          ["ADMIN", "MANAGER", "FRONT_DESK"],
          "ROOM_CLEANED",
          "Room ready for inspection",
          `Room ${taskRoom.number} was marked cleaned and needs inspection.`,
          taskId,
        );
      if (rework) await notifyUsers(tx, auth(req).propertyId, [task.assignedToId], "ROOM_INSPECTION", "Room needs another cleaning pass", `Room ${taskRoom.number} was returned after inspection. Review the room instructions.`, taskId);
      if (data.assignedToId !== undefined && data.assignedToId !== task.assignedToId && data.assignedToId)
        await notifyUsers(tx, auth(req).propertyId, [data.assignedToId], "TASK_ASSIGNED", "Cleaning assignment", "A cleaning task was assigned to you.", taskId);
      return updated;
    }, serial),
  );
});


router.get("/maintenance/report-context", requireRole("HOUSEKEEPING","MAINTENANCE","FRONT_DESK","ADMIN","MANAGER"),async(req,res)=>{
  const [rooms,areas]=await Promise.all([
    prisma.room.findMany({where:{propertyId:auth(req).propertyId,isActive:true},
      select:{id:true,number:true,floor:true},orderBy:[{floor:'asc'},{number:'asc'}]}),
    prisma.publicArea.findMany({where:{propertyId:auth(req).propertyId,isActive:true},
      select:{id:true,name:true,location:true},orderBy:[{sortOrder:'asc'},{name:'asc'}]})
  ]);
  res.json({rooms,areas});
});
router.get("/maintenance/my-reports", requireRole("HOUSEKEEPING","MAINTENANCE","FRONT_DESK","ADMIN","MANAGER"),async(req,res)=>{
  const tickets=await prisma.maintenanceTicket.findMany({
    where:{propertyId:auth(req).propertyId,reportedById:auth(req).userId},
    select:{id:true,title:true,description:true,priority:true,status:true,createdAt:true,updatedAt:true,
      resolution:true,room:{select:{number:true}},publicArea:{select:{name:true,location:true}},
      assignedTo:{select:{name:true}}},
    orderBy:{createdAt:'desc'},take:100
  });
  res.json(tickets);
});
router.get("/maintenance", async (req, res) => {
  const where: Prisma.MaintenanceTicketWhereInput = {
    propertyId: auth(req).propertyId,
  };
  if (!manager(req) && !auth(req).roles.includes("FRONT_DESK"))
    where.OR = [
      { assignedToId: auth(req).userId },
      { reportedById: auth(req).userId },
    ];
  res.json(
    await prisma.maintenanceTicket.findMany({
      where,
      include: {
        room: true,
        publicArea: { select: { id: true, name: true, location: true } },
        assignedTo: { select: userSelect },
        reportedBy: { select: { id:true,name:true } },
        events: { orderBy: { createdAt: "asc" }, take: 100 },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  );
});
router.post("/maintenance", async (req, res) => {
  const data = z
    .object({
      title: z.string().trim().min(1).max(200),
      description: text,
      roomId: id.nullable().optional(),
      publicAreaId: id.nullable().optional(),
      assignedToId: id.nullable().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    })
    .strict()
    .parse(req.body);
  if(data.roomId && data.publicAreaId)throw new HttpError(400,"Choose a room or public area, not both");
  if (
    data.assignedToId &&
    !manager(req) &&
    !auth(req).roles.includes("FRONT_DESK")
  )
    throw new HttpError(403, "Supervisor assignment required");
  res.status(201).json(
    await prisma.$transaction(async (tx) => {
      if (data.roomId) await room(tx, auth(req).propertyId, data.roomId);
      if (data.publicAreaId) {
        const area=await tx.publicArea.findFirst({where:{id:data.publicAreaId,propertyId:auth(req).propertyId,isActive:true}});
        if(!area)throw new HttpError(404,"Public area not found");
      }
      await member(tx, auth(req).propertyId, data.assignedToId, [
        "MAINTENANCE",
      ]);
      const created = await tx.maintenanceTicket.create({
        data: {
          ...data,
          propertyId: auth(req).propertyId,
          reportedById: auth(req).userId,
        },
      });
      await tx.ticketEvent.create({
        data: {
          ticketId: created.id,
          actorId: auth(req).userId,
          toStatus: "OPEN",
          comment: "Ticket created",
        },
      });
      await audit(tx, req, "MaintenanceTicket", created.id, "CREATE");
      const supervisors = await tx.propertyMembership.findMany({
        where: {
          propertyId: auth(req).propertyId,
          isActive: true,
          role: { in: ["ADMIN", "MANAGER", "FRONT_DESK"] },
          user: { isActive: true, deletedAt: null },
        },
        select: { userId: true },
      });
      await notifyUsers(tx, auth(req).propertyId, supervisors.map((item) => item.userId), "MAINTENANCE_CREATED", "Maintenance request", "A new maintenance request needs review.", created.id);
      await notifyUsers(tx, auth(req).propertyId, [created.assignedToId], "TICKET_ASSIGNED", "Maintenance ticket assigned", "A maintenance ticket was assigned to you.", created.id);
      return created;
    }, serial),
  );
});
router.patch("/maintenance/:ticketId", async (req, res) => {
  const ticketId = id.parse(req.params.ticketId);
  const data = z
    .object({
      assignedToId: id.nullable().optional(),
      status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).optional(),
      resolution: z.string().trim().max(2000).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      comment: z.string().max(2000).optional(),
    })
    .strict()
    .parse(req.body);
  res.json(
    await prisma.$transaction(async (tx) => {
      const ticket = await tx.maintenanceTicket.findFirst({
        where: { id: ticketId, propertyId: auth(req).propertyId },
      });
      if (!ticket) throw new HttpError(404, "Ticket not found");
      const supervisor = manager(req) || auth(req).roles.includes("FRONT_DESK");
      if (
        !supervisor &&
        (!auth(req).roles.includes("MAINTENANCE") ||
          ticket.assignedToId !== auth(req).userId ||
          data.assignedToId !== undefined ||
          data.priority !== undefined)
      )
        throw new HttpError(403, "Forbidden");
      await member(tx, auth(req).propertyId, data.assignedToId, [
        "MAINTENANCE",
      ]);
      if (data.status) {
        const allowed: Record<string, string[]> = {
          OPEN: ["IN_PROGRESS", "CLOSED"],
          IN_PROGRESS: ["CLOSED"],
          CLOSED: ["OPEN"],
        };
        if (!allowed[ticket.status].includes(data.status))
          throw new HttpError(409, "Invalid ticket transition");
        if (data.status === "OPEN" && !supervisor)
          throw new HttpError(403, "Supervisor required to reopen");
        if (data.status === "CLOSED" && !data.resolution)
          throw new HttpError(400, "Completion notes required");
      }
      const { comment, ...changes } = data;
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


/** Property-scoped live board: summary only, no guest information. */
router.get("/housekeeping/live-progress", frontDesk, async (req,res)=>{
  const propertyId=auth(req).propertyId;
  const day=businessDate(req);
  const [tasks,rooms]=await prisma.$transaction([
    prisma.cleaningTask.findMany({
      where:{propertyId,scheduledFor:day},
      select:{
        id:true,status:true,cleaningType:true,assignedToId:true,updatedAt:true,
        startedAt:true,completedAt:true,room:{select:{number:true}},
        assignedTo:{select:{id:true,name:true}}
      },orderBy:[{room:{number:'asc'}},{createdAt:'asc'}],take:500
    }),
    prisma.room.groupBy({by:['status'],where:{propertyId,isActive:true},_count:true})
  ]);
  const statuses=['PENDING','IN_PROGRESS','COMPLETED','VERIFIED','CANCELLED'] as const;
  const counts=Object.fromEntries(statuses.map(s=>[s,tasks.filter(t=>t.status===s).length]));
  const eligible=tasks.filter(t=>t.status!=='CANCELLED');
  const done=eligible.filter(t=>t.status==='COMPLETED'||t.status==='VERIFIED').length;
  const employees=new Map<string,{id:string;name:string;assigned:number;pending:number;inProgress:number;awaitingInspection:number;verified:number;done:number}>();
  let unassigned=0;
  for(const task of tasks){
    if(task.status==='CANCELLED')continue;
    if(!task.assignedToId || !task.assignedTo){unassigned++;continue;}
    const e=employees.get(task.assignedToId)??{id:task.assignedToId,name:task.assignedTo.name,
      assigned:0,pending:0,inProgress:0,awaitingInspection:0,verified:0,done:0};
    e.assigned++;
    if(task.status==='PENDING')e.pending++;
    if(task.status==='IN_PROGRESS')e.inProgress++;
    if(task.status==='COMPLETED')e.awaitingInspection++;
    if(task.status==='VERIFIED')e.verified++;
    if(['COMPLETED','VERIFIED'].includes(task.status))e.done++;
    employees.set(e.id,e);
  }
  res.set('Cache-Control','private, no-store');
  res.json({
    date:day.toISOString().slice(0,10),updatedAt:new Date().toISOString(),
    total:eligible.length,done,pending:counts.PENDING,inProgress:counts.IN_PROGRESS,
    awaitingInspection:counts.COMPLETED,verified:counts.VERIFIED,cancelled:counts.CANCELLED,
    unassigned,percent:eligible.length?Math.round(done*100/eligible.length):0,
    roomStatusCounts:Object.fromEntries(rooms.map(r=>[r.status,r._count])),
    employees:[...employees.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    recent:tasks.filter(t=>t.status==='COMPLETED'||t.status==='VERIFIED')
      .sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime()).slice(0,8)
      .map(t=>({id:t.id,room:t.room.number,status:t.status,at:t.updatedAt.toISOString()}))
  });
});
router.get("/dashboard", frontDesk, async (req, res) => {
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
