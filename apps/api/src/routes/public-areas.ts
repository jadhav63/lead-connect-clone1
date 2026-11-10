import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { areaInput, assertSingleAssignee, recurrenceSlots, assertAreaTransition, areaReport } from '../services/public-areas.js';

const router=Router();
router.use(requireAuth);
const management=requireRole('ADMIN','MANAGER');
const serial={isolationLevel:'Serializable' as const};
const uuid=z.uuid();
const date=z.iso.date().transform(x=>new Date(`${x}T00:00:00.000Z`));
const auth=(req:Request)=>req.auth!;
const supervisor=(req:Request)=>auth(req).roles.some(x=>['ADMIN','MANAGER'].includes(x));
const person={id:true,name:true} as const;
const taskInclude={area:{select:{id:true,name:true,location:true,isActive:true}},assignedTo:{select:person},assignedStaff:{select:person},verifiedBy:{select:person},completedBy:{select:person}} as const;
async function dayFor(req:Request) {
  const p=await prisma.property.findUniqueOrThrow({where:{id:auth(req).propertyId},select:{timezone:true}});
  return date.parse(req.query.date ?? new Intl.DateTimeFormat('en-CA',{timeZone:p.timezone}).format(new Date()));
}
async function assignee(tx:Prisma.TransactionClient,propertyId:string,data:{assignedToId?:string|null;assignedStaffId?:string|null}) {
  assertSingleAssignee(data);
  if(data.assignedToId && !await tx.propertyMembership.findFirst({where:{propertyId,userId:data.assignedToId,isActive:true,user:{isActive:true,deletedAt:null}}})) throw new HttpError(400,'Employee must be active in this property');
  if(data.assignedStaffId && !await tx.staffDirectoryEntry.findFirst({where:{id:data.assignedStaffId,propertyId,employmentStatus:'ACTIVE'}})) throw new HttpError(400,'Directory profile must be active in this property; app access remains disabled');
}
async function audit(tx:Prisma.TransactionClient,req:Request,entityType:string,entityId:string,action:'CREATE'|'UPDATE'|'ASSIGN'|'STATUS_CHANGE') {
  await tx.auditLog.create({data:{propertyId:auth(req).propertyId,actorId:auth(req).userId,entityType,entityId,action}});
}
async function area(tx:Prisma.TransactionClient,req:Request,id:string) {
  const row=await tx.publicArea.findFirst({where:{id,propertyId:auth(req).propertyId}});
  if(!row)throw new HttpError(404,'Public area not found'); return row;
}
async function notify(tx:Prisma.TransactionClient,req:Request,userId:string|null,title:string,entityId:string,managers=false) {
  const recipients=managers ? (await tx.propertyMembership.findMany({where:{propertyId:auth(req).propertyId,isActive:true,role:{in:['ADMIN','MANAGER']},user:{isActive:true,deletedAt:null}},select:{userId:true}})).map(x=>x.userId) : userId?[userId]:[];
  if(recipients.length)await tx.notification.createMany({data:[...new Set(recipients)].map(id=>({propertyId:auth(req).propertyId,userId:id,type:'GENERAL',title,message:'Review Public Areas for the daily assignment and checklist.',entityId}))});
}
router.get('/public-areas/assignees',async(req,res)=>{
  const propertyId=auth(req).propertyId;
  const members=await prisma.propertyMembership.findMany({where:{propertyId,isActive:true,user:{isActive:true,deletedAt:null}},select:{user:{select:person}}});
  const staff=supervisor(req)?await prisma.staffDirectoryEntry.findMany({where:{propertyId,employmentStatus:'ACTIVE'},select:person,orderBy:{name:'asc'}}):[];
  res.json({users:[...new Map(members.map(x=>[x.user.id,x.user])).values()],staff});
});
router.get('/public-areas',async(req,res)=>res.json(await prisma.publicArea.findMany({where:{propertyId:auth(req).propertyId,...(!supervisor(req)?{isActive:true}:{})},orderBy:[{sortOrder:'asc'},{name:'asc'}]})));
router.post('/public-areas',management,async(req,res)=>{
  const data=areaInput.parse(req.body);
  const row=await prisma.$transaction(async tx=>{
    await assignee(tx,auth(req).propertyId,data);
    const last=await tx.publicArea.aggregate({where:{propertyId:auth(req).propertyId},_max:{sortOrder:true}});
    const saved=await tx.publicArea.create({data:{...data,propertyId:auth(req).propertyId,sortOrder:(last._max.sortOrder??-1)+1}});
    await audit(tx,req,'PublicArea',saved.id,'CREATE');return saved;
  },serial);res.status(201).json(row);
});
router.patch('/public-areas/:areaId',management,async(req,res)=>{
  const areaId=uuid.parse(req.params.areaId),data=areaInput.partial().parse(req.body);
  const today=await dayFor(req);
  res.json(await prisma.$transaction(async tx=>{
    const before=await area(tx,req,areaId);
    if(data.assignedToId!==undefined || data.assignedStaffId!==undefined)await assignee(tx,auth(req).propertyId,{...before,...data});
    const saved=await tx.publicArea.update({where:{id:areaId},data});
    if(data.isActive===false)await tx.publicAreaTask.updateMany({where:{propertyId:auth(req).propertyId,areaId,status:'PENDING',scheduledFor:{gte:today}},data:{status:'CANCELLED'}});
    await audit(tx,req,'PublicArea',areaId,'UPDATE');return saved;
  },serial));
});
router.post('/public-areas/reorder',management,async(req,res)=>{
  const {ids}=z.object({ids:z.array(uuid).max(500).refine(x=>new Set(x).size===x.length)}).strict().parse(req.body);
  await prisma.$transaction(async tx=>{
    const own=await tx.publicArea.findMany({where:{propertyId:auth(req).propertyId},select:{id:true}});
    if(own.length!==ids.length || own.some(x=>!ids.includes(x.id)))throw new HttpError(409,'Reorder must include exactly this property’s areas');
    for(const [sortOrder,id] of ids.entries())await tx.publicArea.update({where:{id},data:{sortOrder}});
    await audit(tx,req,'PublicAreaOrder',auth(req).propertyId,'UPDATE');
  },serial);res.json({saved:true});
});
router.post('/public-area-tasks/prepare',management,async(req,res)=>{
  const {from,to}=z.object({from:date,to:date}).strict().parse(req.body);
  const span=(to.getTime()-from.getTime())/86400000;
  if(span<0 || span>30)throw new HttpError(400,'Choose a range of at most 31 days');
  const count=await prisma.$transaction(async tx=>{
    const areas=await tx.publicArea.findMany({where:{propertyId:auth(req).propertyId,isActive:true}});
    let created=0;
    for(const a of areas) {
      await assignee(tx,auth(req).propertyId,a);
      const rows=[];
      for(let n=0;n<=span;n++){
        const day=new Date(from.getTime()+n*86400000);
        for(const slot of recurrenceSlots(a.frequency,a.weeklyDay,day))rows.push({propertyId:auth(req).propertyId,areaId:a.id,scheduledFor:day,slot,createdById:auth(req).userId,checklist:a.checklist,completedItems:[],assignedToId:a.assignedToId,assignedStaffId:a.assignedStaffId});
      }
      const saved=await tx.publicAreaTask.createMany({data:rows,skipDuplicates:true});created+=saved.count;
      if(saved.count)await notify(tx,req,a.assignedToId,'Public-area cleaning assigned',a.id);
    }
    if(created)await audit(tx,req,'PublicAreaSchedule',auth(req).propertyId,'CREATE');return created;
  },serial);res.status(201).json({created:count});
});
router.post('/public-areas/:areaId/tasks',management,async(req,res)=>{
  const areaId=uuid.parse(req.params.areaId);
  const body=z.object({date,slot:z.number().int().min(1).max(10).default(1)}).strict().parse(req.body);
  const saved=await prisma.$transaction(async tx=>{
    const a=await area(tx,req,areaId);if(!a.isActive)throw new HttpError(409,'Area is inactive');
    await assignee(tx,auth(req).propertyId,a);
    const task=await tx.publicAreaTask.create({data:{propertyId:auth(req).propertyId,areaId,scheduledFor:body.date,slot:body.slot,assignedToId:a.assignedToId,assignedStaffId:a.assignedStaffId,createdById:auth(req).userId,checklist:a.checklist,completedItems:[]}});
    await audit(tx,req,'PublicAreaTask',task.id,'CREATE');await notify(tx,req,task.assignedToId,'Public-area cleaning assigned',task.id);return task;
  },serial);res.status(201).json(saved);
});
router.get('/public-area-tasks',async(req,res)=>{
  const day=await dayFor(req);
  res.json(await prisma.publicAreaTask.findMany({where:{propertyId:auth(req).propertyId,scheduledFor:day,...(!supervisor(req)?{assignedToId:auth(req).userId}:{})},include:taskInclude,orderBy:[{area:{sortOrder:'asc'}},{slot:'asc'}]}));
});
router.patch('/public-area-tasks/:taskId',async(req,res)=>{
  const taskId=uuid.parse(req.params.taskId);
  const data=z.object({status:z.enum(['IN_PROGRESS','COMPLETED','VERIFIED','CANCELLED']).optional(),completedItems:z.array(z.string().max(200)).max(40).optional(),notes:z.string().trim().max(2000).nullable().optional(),assignedToId:uuid.nullable().optional(),assignedStaffId:uuid.nullable().optional()}).strict().parse(req.body);
  res.json(await prisma.$transaction(async tx=>{
    const before=await tx.publicAreaTask.findFirst({where:{id:taskId,propertyId:auth(req).propertyId}});
    if(!before)throw new HttpError(404,'Public-area task not found');
    const isSupervisor=supervisor(req),isAssigned=before.assignedToId===auth(req).userId;
    if(!isSupervisor && !isAssigned)throw new HttpError(403,'Only the assigned login employee or a supervisor may update this task');
    if(['VERIFIED','CANCELLED'].includes(before.status))throw new HttpError(409,'Closed tasks are read-only');
    const assigning=data.assignedToId!==undefined || data.assignedStaffId!==undefined;
    if(before.status==='COMPLETED' && (assigning || data.notes!==undefined || data.completedItems!==undefined))throw new HttpError(409,'Completed cleaning evidence is read-only; a supervisor may return it for cleaning');
    if(assigning){
      if(!isSupervisor)throw new HttpError(403,'Supervisor assignment required');
      if(!['PENDING','IN_PROGRESS'].includes(before.status))throw new HttpError(409,'Reassign unfinished tasks only');
      if(data.status!==undefined)throw new HttpError(400,'Reassign separately from changing task status');
      await assignee(tx,auth(req).propertyId,{...before,...data});
    }
    const checked=data.completedItems ?? before.completedItems;
    if(data.completedItems && before.status!=='IN_PROGRESS')throw new HttpError(409,'Start the task before checking items');
    if(checked.some(x=>!before.checklist.includes(x)) || new Set(checked).size!==checked.length)throw new HttpError(400,'Invalid checklist item');
    if(data.status)assertAreaTransition(before.status,data.status,isSupervisor,isAssigned,before.checklist,checked);
    if(data.status==='VERIFIED' && before.completedById===auth(req).userId)throw new HttpError(403,'A different supervisor must verify this cleaning');
    const now=new Date();
    const reassigned=assigning && (data.assignedToId!==undefined&&data.assignedToId!==before.assignedToId || data.assignedStaffId!==undefined&&data.assignedStaffId!==before.assignedStaffId);
    const updated=await tx.publicAreaTask.update({where:{id:taskId},data:{...data,
      ...(reassigned?{status:'PENDING',startedAt:null,completedAt:null,completedById:null,verifiedAt:null,verifiedById:null,completedItems:[]}:{}),
      ...(data.status==='IN_PROGRESS'?{startedAt:before.startedAt??now,completedAt:null,completedById:null,verifiedAt:null,verifiedById:null,completedItems:[]} : {}),
      ...(data.status==='COMPLETED'?{completedAt:now,completedById:auth(req).userId}:{}),
      ...(data.status==='VERIFIED'?{verifiedAt:now,verifiedById:auth(req).userId}:{})}});
    await audit(tx,req,'PublicAreaTask',taskId,assigning?'ASSIGN':'STATUS_CHANGE');
    if(assigning)await notify(tx,req,updated.assignedToId,'Public-area cleaning assigned',taskId);
    if(data.status==='COMPLETED')await notify(tx,req,null,'Public-area cleaning needs verification',taskId,true);
    return updated;
  },serial));
});
router.get('/public-areas/:areaId/history',async(req,res)=>{
  const areaId=uuid.parse(req.params.areaId);
  if(!await prisma.publicArea.findFirst({where:{id:areaId,propertyId:auth(req).propertyId}}))throw new HttpError(404,'Public area not found');
  res.json(await prisma.publicAreaTask.findMany({where:{propertyId:auth(req).propertyId,areaId,...(!supervisor(req)?{assignedToId:auth(req).userId}:{})},include:taskInclude,orderBy:[{scheduledFor:'desc'},{slot:'asc'}],take:100}));
});
router.post('/public-areas/:areaId/maintenance',async(req,res)=>{
  const areaId=uuid.parse(req.params.areaId);
  const body=z.object({title:z.string().trim().min(2).max(200),description:z.string().trim().min(2).max(2000),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).default('MEDIUM')}).strict().parse(req.body);
  const ticket=await prisma.$transaction(async tx=>{
    const a=await area(tx,req,areaId);if(!a.isActive)throw new HttpError(409,'Area is inactive');
    const saved=await tx.maintenanceTicket.create({data:{...body,propertyId:auth(req).propertyId,publicAreaId:areaId,reportedById:auth(req).userId,events:{create:{actorId:auth(req).userId,toStatus:'OPEN',comment:'Public-area maintenance request'}}}});
    await audit(tx,req,'MaintenanceTicket',saved.id,'CREATE');await notify(tx,req,null,'Public-area maintenance reported',saved.id,true);return saved;
  },serial);res.status(201).json(ticket);
});
router.get('/public-area-reports',management,async(req,res)=>{
  const day=await dayFor(req),propertyId=auth(req).propertyId;
  const tasks=await prisma.publicAreaTask.findMany({where:{propertyId,OR:[{scheduledFor:day},{scheduledFor:{lt:day},status:{in:['PENDING','IN_PROGRESS','COMPLETED']}}]},include:taskInclude,orderBy:[{scheduledFor:'desc'},{slot:'asc'}]});
  const issues=await prisma.maintenanceTicket.findMany({where:{propertyId,publicAreaId:{not:null}},include:{publicArea:{select:{id:true,name:true}}},orderBy:{createdAt:'desc'}});
  res.json({date:day.toISOString().slice(0,10),...areaReport(tasks,day),tasks:tasks.filter(t=>t.scheduledFor.getTime()===day.getTime()),missedTasks:tasks.filter(t=>t.scheduledFor<day && ['PENDING','IN_PROGRESS'].includes(t.status)),maintenanceIssues:issues});
});
export default router;
