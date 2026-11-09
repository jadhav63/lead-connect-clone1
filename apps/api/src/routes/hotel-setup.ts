import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "MANAGER"));
const code = "58835";
const roomTypes = ["AC1", "AC2", "AC3", "RM1", "RM2", "RM3", "SU1"] as const;
const counts: Record<string, number> = { AC1: 1, AC2: 2, AC3: 1, RM1: 5, RM2: 42, RM3: 8, SU1: 1 };
const roomInput = z.object({
  number: z.string().regex(/^\\d{3}$/),
  floor: z.number().int().min(1).max(2),
  roomType: z.enum(roomTypes),
  initialStatus: z.enum(["CLEAN", "DIRTY", "IN_PROGRESS", "INSPECTION", "MAINTENANCE", "OUT_OF_ORDER"]).optional(),
  initialOccupancyStatus: z.enum(["VACANT", "OCCUPIED", "ARRIVAL", "DEPARTURE"]).optional(),
}).strict();
const inventoryInput = z.object({ propertyCode: z.literal("58835"), rooms: z.array(roomInput).length(60), approvalReference: z.string().optional() }).strict();
const nullableText = z.string().trim().max(200).nullable().optional();
const staffInput = z.object({
  name: z.string().trim().min(2).max(200),
  phone: z.string().trim().regex(/^\\d{10}$/).nullable().optional(),
  email: z.union([z.email(), z.literal(""), z.null()]).optional(),
  department: z.enum(["Management", "Front Desk", "Housekeeping", "Laundry", "Maintenance", "Breakfast"]).nullable().optional(),
  jobRole: nullableText,
  employmentStatus: z.enum(["PENDING_REVIEW", "ACTIVE", "INACTIVE"]).optional(),
}).strict();
function normalizedName(name: string) { return name.trim().replace(/\\s+/g, " ").toLocaleLowerCase("en-US"); }
function requestProperty(req: Request) { return req.auth!.propertyId; }
function requireImportGate() {
  if (process.env.TGH_IMPORT_ENABLED !== "true" || process.env.APP_ENV !== "production")
    throw new HttpError(403, "Import is disabled until JD approves production activation");
}
async function confirmProperty(req: Request, supplied: string) {
  const p = await prisma.property.findUnique({ where: { id: requestProperty(req) }, select: { code: true } });
  if (supplied !== code || p?.code !== code) throw new HttpError(403, "Wrong property; import refused");
}
function checkRoomRows(rooms: z.infer<typeof roomInput>[]) {
  const unique = new Set(rooms.map(r => r.number));
  if (unique.size !== 60) throw new HttpError(400, "Duplicate or missing rooms");
  for (const type of roomTypes) if (rooms.filter(r => r.roomType === type).length !== counts[type])
    throw new HttpError(400, "Room type totals must match the approved 60-room inventory");
  for (const r of rooms) if (Number(r.number[0]) !== r.floor)
    throw new HttpError(400, "Room floor does not match room number");
}
async function inventoryPreview(req: Request, body: z.infer<typeof inventoryInput>) {
  await confirmProperty(req, body.propertyCode);
  checkRoomRows(body.rooms);
  const existing = await prisma.room.findMany({ where: { propertyId: requestProperty(req) }, select: { number: true, roomType: true, floor: true } });
  const map = new Map(existing.map(r => [r.number, r]));
  const conflicts = body.rooms.filter(r => map.has(r.number) && (map.get(r.number)!.roomType !== r.roomType || map.get(r.number)!.floor !== r.floor)).map(r => r.number);
  return { total: 60, toCreate: body.rooms.filter(r => !map.has(r.number)).length, alreadyPresent: body.rooms.filter(r => map.has(r.number)).length, conflicts, missingInitialStatus: body.rooms.filter(r => !r.initialStatus || !r.initialOccupancyStatus).map(r => r.number), databaseModified: false };
}
router.post("/room-inventory/preview", async (req, res) => {
  const body = inventoryInput.parse(req.body);
  res.json(await inventoryPreview(req, body));
});
router.post("/room-inventory/apply", async (req, res) => {
  requireImportGate();
  const body = inventoryInput.parse(req.body);
  if (!body.approvalReference || !/^JD-APPROVED-[A-Z0-9-]{6,}$/.test(body.approvalReference)) throw new HttpError(403, "JD approval reference required");
  const preview = await inventoryPreview(req, body);
  if (preview.conflicts.length || preview.missingInitialStatus.length) throw new HttpError(409, "Resolve conflicts and explicitly confirm initial room statuses before import");
  const inserted = await prisma.$transaction(async tx => {
    const existing = await tx.room.findMany({ where: { propertyId: requestProperty(req) }, select: { number: true, roomType: true, floor: true } });
    const map = new Map(existing.map(r => [r.number, r]));
    if (body.rooms.some(r => map.has(r.number) && (map.get(r.number)!.roomType !== r.roomType || map.get(r.number)!.floor !== r.floor))) throw new HttpError(409, "Room inventory conflict");
    const rows = body.rooms.filter(r => !map.has(r.number));
    if (rows.length) await tx.room.createMany({ data: rows.map(r => ({
      propertyId: requestProperty(req), number: r.number, floor: r.floor, roomType: r.roomType,
      status: r.initialStatus!, occupancyStatus: r.initialOccupancyStatus!
    })) });
    await tx.auditLog.create({ data: { propertyId: requestProperty(req), actorId: req.auth!.userId, action: "CREATE", entityType: "RoomInventoryImport", entityId: requestProperty(req), after: { created: rows.length, approvalReference: body.approvalReference } } });
    return rows.length;
  }, { isolationLevel: "Serializable" });
  res.json({ created: inserted, alreadyPresent: 60 - inserted });
});
router.get("/staff-directory", async (req, res) => {
  res.json(await prisma.staffDirectoryEntry.findMany({ where: { propertyId: requestProperty(req) }, orderBy: { name: "asc" } }));
});
router.post("/staff-directory", async (req, res) => {
  const data = staffInput.parse(req.body);
  const row = await prisma.staffDirectoryEntry.create({ data: {
    propertyId: requestProperty(req), name: data.name, normalizedName: normalizedName(data.name),
    email: data.email || null, phone: data.phone || null, department: data.department || null,
    jobRole: data.jobRole || null, employmentStatus: data.employmentStatus ?? "PENDING_REVIEW", appAccessEnabled: false
  }});
  res.status(201).json(row);
});
router.patch("/staff-directory/:entryId", async (req, res) => {
  const entryId = z.uuid().parse(req.params.entryId);
  const data = staffInput.partial().parse(req.body);
  const before = await prisma.staffDirectoryEntry.findFirst({ where: { id: entryId, propertyId: requestProperty(req) } });
  if (!before) throw new HttpError(404, "Staff directory entry not found");
  const updated = await prisma.staffDirectoryEntry.update({ where: { id: entryId }, data: {
    ...(data.name !== undefined ? { name: data.name, normalizedName: normalizedName(data.name) } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
    ...(data.email !== undefined ? { email: data.email || null } : {}),
    ...(data.department !== undefined ? { department: data.department || null } : {}),
    ...(data.jobRole !== undefined ? { jobRole: data.jobRole || null } : {}),
    ...(data.employmentStatus !== undefined ? { employmentStatus: data.employmentStatus } : {})
  }});
  res.json(updated);
});
const staffBatch = z.object({ propertyCode: z.literal("58835"), records: z.array(staffInput).min(1).max(100), approvalReference: z.string().optional() }).strict();
async function staffPreview(req: Request, body: z.infer<typeof staffBatch>) {
  await confirmProperty(req, body.propertyCode);
  const names = body.records.map(r => normalizedName(r.name));
  if (new Set(names).size !== names.length) throw new HttpError(400, "Duplicate staff names in import file");
  const existing = await prisma.staffDirectoryEntry.findMany({ where: { propertyId: requestProperty(req) }, select: { normalizedName: true } });
  const found = new Set(existing.map(x => x.normalizedName));
  return { total: names.length, toCreate: names.filter(n => !found.has(n)).length, alreadyPresent: names.filter(n => found.has(n)).length, missingEmails: body.records.filter(r => !r.email).length, allAppAccessDisabled: true, databaseModified: false };
}
router.post("/staff-directory/import-preview", async (req, res) => {
  const body = staffBatch.parse(req.body);
  res.json(await staffPreview(req, body));
});
router.post("/staff-directory/import", async (req, res) => {
  requireImportGate();
  const body = staffBatch.parse(req.body);
  if (!body.approvalReference || !/^JD-APPROVED-[A-Z0-9-]{6,}$/.test(body.approvalReference)) throw new HttpError(403, "JD approval reference required");
  await staffPreview(req, body);
  const created = await prisma.$transaction(async tx => {
    const existing = new Set((await tx.staffDirectoryEntry.findMany({ where: { propertyId: requestProperty(req) }, select: { normalizedName: true } })).map(x => x.normalizedName));
    const rows = body.records.filter(r => !existing.has(normalizedName(r.name)));
    if (rows.length) await tx.staffDirectoryEntry.createMany({ data: rows.map(r => ({
      propertyId: requestProperty(req), name: r.name, normalizedName: normalizedName(r.name),
      email: r.email || null, phone: r.phone || null, department: r.department || null,
      jobRole: r.jobRole || null, employmentStatus: "PENDING_REVIEW", appAccessEnabled: false
    })) });
    await tx.auditLog.create({ data: { propertyId: requestProperty(req), actorId: req.auth!.userId, action: "CREATE", entityType: "StaffDirectoryImport", entityId: requestProperty(req), after: { created: rows.length, approvalReference: body.approvalReference } } });
    return rows.length;
  }, { isolationLevel: "Serializable" });
  res.json({ created, appAccessEnabled: false });
});
export default router;
