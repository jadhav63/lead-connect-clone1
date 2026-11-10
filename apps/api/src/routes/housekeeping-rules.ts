import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'MANAGER'));

// Each property has isolated settings; changes are versioned, reviewed and audited.
export const housekeepingRulesSchema = z.object({
  minutes: z.object({
    checkout: z.number().int().min(5).max(240),
    stayover: z.number().int().min(5).max(240),
    fullService: z.number().int().min(5).max(240),
    petCheckout: z.number().int().min(5).max(240),
    deepClean: z.number().int().min(5).max(240),
    arrivalTouchup: z.number().int().min(5).max(240),
    cartSetup: z.number().int().min(0).max(120),
    secondFloorAllowance: z.number().int().min(0).max(120),
    lunch: z.number().int().min(0).max(120),
  }).strict(),
  priority: z.array(z.enum(['CHECKOUT','STAYOVER','ARRIVAL'])).length(3).refine(x=>new Set(x).size===3),
  startTime: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/),
  fullServiceEveryDays: z.number().int().min(1).max(14),
  balanceMinutes: z.boolean(),
  groupFloors: z.boolean(),
  startOnFirstFloor: z.boolean(),
  lightStayoversToLaundry: z.boolean(),
  manualOverrideAllowed: z.boolean(),
}).strict();

export type HousekeepingRules = z.infer<typeof housekeepingRulesSchema>;
export const defaultHousekeepingRules: HousekeepingRules = {
  minutes: {checkout:30, stayover:15, fullService:30, petCheckout:45, deepClean:60,
    arrivalTouchup:15, cartSetup:30, secondFloorAllowance:30, lunch:30},
  priority:['CHECKOUT','STAYOVER','ARRIVAL'], startTime:'08:00', fullServiceEveryDays:3,
  balanceMinutes:true,groupFloors:true,startOnFirstFloor:true,
  lightStayoversToLaundry:true,manualOverrideAllowed:true,
};

const property = (req: {auth?:{propertyId:string}}) => req.auth!.propertyId;
const actor = (req: {auth?:{userId:string}}) => req.auth!.userId;

router.get('/settings/housekeeping-rules',async(req,res)=>{
  const current = await prisma.housekeepingRuleVersion.findFirst({
    where:{propertyId:property(req)},orderBy:{version:'desc'},
    select:{version:true,settings:true,createdAt:true,createdBy:{select:{name:true}}}
  });
  res.json(current?{...current,settings:housekeepingRulesSchema.parse(current.settings)}:
    {version:0,settings:defaultHousekeepingRules,createdAt:null,createdBy:null});
});

router.get('/settings/housekeeping-rules/history',async(req,res)=>{
  const versions=await prisma.housekeepingRuleVersion.findMany({
    where:{propertyId:property(req)},orderBy:{version:'desc'},take:30,
    select:{version:true,createdAt:true,createdBy:{select:{name:true}}}
  });
  res.json(versions);
});

// Save is compare-and-swap; never overwrite a change another manager just made.
router.put('/settings/housekeeping-rules',async(req,res)=>{
  const body=z.object({expectedVersion:z.number().int().min(0),settings:housekeepingRulesSchema}).strict().parse(req.body);
  const result=await prisma.$transaction(async tx=>{
    const latest=await tx.housekeepingRuleVersion.findFirst({where:{propertyId:property(req)},orderBy:{version:'desc'}});
    if((latest?.version??0)!==body.expectedVersion)throw new HttpError(409,'Rules changed. Refresh and review before saving.');
    const next=await tx.housekeepingRuleVersion.create({data:{
      propertyId:property(req),createdById:actor(req),version:body.expectedVersion+1,settings:body.settings
    }});
    await tx.auditLog.create({data:{propertyId:property(req),actorId:actor(req),entityType:'HousekeepingRules',entityId:next.id,
      action:'UPDATE',before:latest?.settings??defaultHousekeepingRules,after:body.settings}});
    return {version:next.version,settings:body.settings};
  },{isolationLevel:'Serializable'});
  res.json(result);
});

router.post('/settings/housekeeping-rules/restore',async(req,res)=>{
  const {version,expectedVersion}=z.object({version:z.number().int().positive(),expectedVersion:z.number().int().min(0)}).strict().parse(req.body);
  const result=await prisma.$transaction(async tx=>{
    const previous=await tx.housekeepingRuleVersion.findUnique({where:{propertyId_version:{propertyId:property(req),version}}});
    if(!previous)throw new HttpError(404,'Rule version not found');
    const latest=await tx.housekeepingRuleVersion.findFirst({where:{propertyId:property(req)},orderBy:{version:'desc'}});
    if((latest?.version??0)!==expectedVersion)throw new HttpError(409,'Rules changed. Refresh before restoring.');
    const settings=housekeepingRulesSchema.parse(previous.settings);
    const next=await tx.housekeepingRuleVersion.create({data:{propertyId:property(req),createdById:actor(req),version:expectedVersion+1,settings}});
    await tx.auditLog.create({data:{propertyId:property(req),actorId:actor(req),action:'UPDATE',entityType:'HousekeepingRules',
      entityId:next.id,before:latest?.settings??defaultHousekeepingRules,after:settings}});
    return {version:next.version,settings};
  },{isolationLevel:'Serializable'});
  res.json(result);
});

// Preview is always read-only; assignment mutations remain controlled by existing APIs.
router.post('/settings/housekeeping-rules/preview',async(req,res)=>{
  const rules=housekeepingRulesSchema.parse(req.body);
  const date=z.iso.date().parse(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Phoenix'}).format(new Date()));
  const tasks=await prisma.cleaningTask.findMany({
    where:{propertyId:property(req),scheduledFor:new Date(date+'T00:00:00.000Z'),status:{in:['PENDING','IN_PROGRESS']}},
    include:{room:{select:{number:true,floor:true}},assignedTo:{select:{name:true}}}
  });
  const kinds:Record<string,number>={CHECKOUT:rules.minutes.checkout,STAYOVER:rules.minutes.stayover,
    FULL_SERVICE:rules.minutes.fullService,DEEP_CLEAN:rules.minutes.deepClean,ARRIVAL_TOUCHUP:rules.minutes.arrivalTouchup};
  const estimates=tasks.map(t=>({room:t.room.number,floor:t.room.floor,cleaningType:t.cleaningType,
    assignee:t.assignedTo?.name??'Unassigned',minutes:kinds[t.cleaningType]??0}));
  res.json({businessDate:date,tasks:estimates,totalEstimatedMinutes:estimates.reduce((n,t)=>n+t.minutes,0),
    notice:'Read-only estimate. No employees or rooms were reassigned.'});
});
export default router;
