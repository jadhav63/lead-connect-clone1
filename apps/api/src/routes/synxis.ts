import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/errors.js';
import { defaultHousekeepingRules, housekeepingRulesSchema } from './housekeeping-rules.js';
import { extractSynxisPdf, type SynxisRoom } from '../services/synxis-pdf.js';
import { buildAssignmentPlan, type PlanTask } from '../services/housekeeping-planner.js';

const router=Router();
const manager=requireRole('ADMIN','MANAGER');
router.use('/housekeeping/synxis',requireAuth,manager);
router.use('/housekeeping/auto-assign',requireAuth,manager);
const businessDate=z.iso.date();
const pdfBody=z.object({businessDate,pdfBase64:z.string().min(100).max(1150000)}).strict();
function parsePdf(raw:string){
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw new HttpError(400,'Invalid PDF encoding');
  return extractSynxisPdf(Buffer.from(raw,'base64'));
}
async function getRules(propertyId:string) {
  const latest=await prisma.housekeepingRuleVersion.findFirst({where:{propertyId},orderBy:{version:'desc'}});
  return {version:latest?.version??0,rules:latest?housekeepingRulesSchema.parse(latest.settings):defaultHousekeepingRules};
}
function reviewService(r:SynxisRoom,date:string,fullServiceEveryDays:number):'CHECKOUT'|'STAYOVER'|'FULL_SERVICE'|'ARRIVAL_TOUCHUP'|null{
  if(r.outOfOrder||r.outOfInventory||r.hkStatus==='CLEAN')return null;
  if(/Checked\s*Out|Departures?/i.test(r.guestStatus))return 'CHECKOUT';
  if(/Arrivals?|Arriving/i.test(r.guestStatus))return 'ARRIVAL_TOUCHUP';
  if(/Stay\s*Overs?|In House|Checked In/i.test(r.guestStatus)){
    const dayMonth=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i.exec(r.checkIn);
    if(dayMonth){
      const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(dayMonth[1].toLowerCase());
      let d=new Date(Date.UTC(Number(date.slice(0,4)),month,Number(dayMonth[2])));
      const today=new Date(date+'T00:00:00.000Z');
      if(d>today)d=new Date(Date.UTC(Number(date.slice(0,4))-1,month,Number(dayMonth[2])));
      const days=Math.floor((today.getTime()-d.getTime())/86400000);
      if(days>=0 && days<365 && (days+1)%fullServiceEveryDays===0)return 'FULL_SERVICE';
    }
    return 'STAYOVER';
  }
  return null;
}
async function inspect(propertyId:string,date:string,base64:string){
  const extracted=parsePdf(base64);
  const inventory=await prisma.room.findMany({where:{propertyId,isActive:true},select:{
    id:true,number:true,roomType:true,status:true,occupancyStatus:true,version:true
  }});
  const map=new Map(inventory.map(r=>[r.number,r]));
  const {rules,version}=await getRules(propertyId);
  const warnings:string[]=[];
  if(extracted.rooms.length!==60)warnings.push('PDF must contain exactly 60 valid room rows; found '+extracted.rooms.length);
  if(extracted.duplicates.length)warnings.push('Duplicate rooms: '+extracted.duplicates.join(', '));
  if(inventory.length!==60)warnings.push('First import the 60 verified hotel rooms. Currently '+inventory.length+' exist.');
  if(!extracted.reportDate)warnings.push('Could not verify the PDF report date');
  else if(extracted.reportDate!==date)warnings.push('PDF is dated '+extracted.reportDate+' but selected business date is '+date);
  const rows=extracted.rooms.map(r=>{
    const existing=map.get(r.number);
    const issues:string[]=[];
    if(!existing)issues.push('Room not registered in Lead Connect');
    if(existing?.roomType && existing.roomType!==r.roomType)issues.push('Room type mismatch');
    if(r.warning)issues.push(r.warning);
    if(r.outOfOrder||r.outOfInventory)issues.push('OOO/OOI — preserve existing maintenance status; do not assign');
    const cleaningType=reviewService(r,date,rules.fullServiceEveryDays);
    if(r.hkStatus==='DIRTY'&&!cleaningType&&!r.outOfOrder&&!r.outOfInventory)issues.push('Dirty room needs manual service classification');
    const minutes=cleaningType==='CHECKOUT'?(r.pet?rules.minutes.petCheckout:rules.minutes.checkout):
      cleaningType==='STAYOVER'?rules.minutes.stayover:
      cleaningType==='FULL_SERVICE'?rules.minutes.fullService:
      cleaningType==='ARRIVAL_TOUCHUP'?rules.minutes.arrivalTouchup:0;
    return {number:r.number,roomType:r.roomType,hkStatus:r.hkStatus,occupancyStatus:r.occupancyStatus,
      guestStatus:r.guestStatus,pet:r.pet,ooo:r.outOfOrder,ooi:r.outOfInventory,cleaningType,minutes,
      issues,roomId:existing?.id??null};
  });
  if(rows.some(r=>r.issues.some(s=>!s.includes('OOO/OOI'))))warnings.push('Some room rows require review');
  const candidates=rows.filter(r=>r.cleaningType&&!r.ooo&&!r.ooi);
  const existingTasks=await prisma.cleaningTask.findMany({
    where:{propertyId,scheduledFor:new Date(date+'T00:00:00.000Z')},
    select:{roomId:true,status:true}
  });
  const busyRooms=new Set(existingTasks.map(t=>t.roomId));
  if(candidates.some(c=>c.roomId&&busyRooms.has(c.roomId)))warnings.push('Some rooms already have housekeeping tasks on this date');
  const active=await prisma.cleaningTask.count({where:{propertyId,status:{in:['PENDING','IN_PROGRESS']}}});
  if(active)warnings.push('Existing active cleaning tasks must be reviewed before SynXis status overwrite');
  const fingerprint=createHash('sha256').update(extracted.sha256+'|'+date+'|'+propertyId+'|'+version+'|'+
    inventory.map(r=>r.number+':'+r.version).sort().join('|')).digest('hex');
  return {reportDate:extracted.reportDate,businessDate:date,rows,candidates:candidates.length,
    totalEstimatedMinutes:candidates.reduce((n,c)=>n+c.minutes,0),registeredRooms:inventory.length,
    rulesVersion:version,fingerprint,warnings,canApply:warnings.length===0&&rows.length===60&&candidates.length>0,
    databaseModified:false,format:extracted.reportFormat};
}
router.post('/housekeeping/synxis/preview',async(req,res)=>{
  const b=pdfBody.parse(req.body);
  res.json(await inspect(req.auth!.propertyId,b.businessDate,b.pdfBase64));
});
router.post('/housekeeping/synxis/apply',async(req,res)=>{
  const b=pdfBody.extend({expectedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),confirm:z.literal('APPROVE')}).parse(req.body);
  const propertyId=req.auth!.propertyId;
  const review=await inspect(propertyId,b.businessDate,b.pdfBase64);
  if(!review.canApply || review.fingerprint!==b.expectedFingerprint)
    throw new HttpError(409,'PDF preview is stale or contains unresolved issues. Preview again.');
  const date=new Date(b.businessDate+'T00:00:00.000Z');
  const applied=await prisma.$transaction(async tx=>{
    const active=await tx.cleaningTask.count({where:{propertyId,status:{in:['PENDING','IN_PROGRESS']}}});
    if(active)throw new HttpError(409,'Active room tasks changed. Review again.');
    let created=0,updated=0;
    for(const r of review.rows){
      if(!r.roomId || r.ooo||r.ooi)continue;
      const status=r.hkStatus;
      const changed=await tx.room.updateMany({where:{id:r.roomId,propertyId,isActive:true},
        data:{status,occupancyStatus:r.occupancyStatus,version:{increment:1}}});
      if(changed.count!==1)throw new HttpError(409,'Room changed while importing');
      updated++;
      if(r.cleaningType){
        const existing=await tx.cleaningTask.count({where:{propertyId,roomId:r.roomId,scheduledFor:date}});
        if(existing)throw new HttpError(409,'Existing cleaning assignment — import cancelled');
        await tx.cleaningTask.create({data:{propertyId,roomId:r.roomId,createdById:req.auth!.userId,
          scheduledFor:date,cleaningType:r.cleaningType,
          instructions:r.pet?'Pet In Room — follow pet-room cleaning procedure':undefined}});
        created++;
      }
    }
    await tx.auditLog.create({data:{propertyId,actorId:req.auth!.userId,action:'CREATE',entityType:'SynxisPdfImport',
      entityId:propertyId,after:{businessDate:b.businessDate,roomStatusesUpdated:updated,tasksCreated:created,
        reportDate:review.reportDate,ruleVersion:review.rulesVersion}}});
    return {roomStatusesUpdated:updated,tasksCreated:created};
  },{isolationLevel:'Serializable',timeout:30000});
  res.json(applied);
});
async function autoPreview(propertyId:string,date:string){
  const {rules,version}=await getRules(propertyId);
  const tasks=await prisma.cleaningTask.findMany({where:{propertyId,scheduledFor:new Date(date+'T00:00:00.000Z'),
    status:{in:['PENDING','IN_PROGRESS']}},include:{room:{select:{number:true,floor:true}}}});
  const members=await prisma.propertyMembership.findMany({where:{propertyId,role:'HOUSEKEEPING',isActive:true,
    user:{isActive:true,deletedAt:null}},select:{user:{select:{id:true,name:true}}}});
  const staff=[...new Map(members.map(m=>[m.user.id,m.user])).values()];
  const planTasks:PlanTask[]=tasks.map(t=>({id:t.id,roomNumber:t.room.number,floor:t.room.floor,
    cleaningType:t.cleaningType,notes:t.instructions,assignedToId:t.assignedToId,status:t.status}));
  const result=buildAssignmentPlan(planTasks,staff,rules);
  const basis=JSON.stringify({date,version,tasks:planTasks.map(t=>[t.id,t.status,t.assignedToId]).sort(),
    staff:staff.map(s=>s.id).sort()});
  const fingerprint=createHash('sha256').update(basis).digest('hex');
  return {...result,rulesVersion:version,fingerprint,taskCount:tasks.length,
    canApply:result.assignments.length>0&&result.unassigned===0,databaseModified:false};
}
router.get('/housekeeping/auto-assign/preview',async(req,res)=>{
  const date=businessDate.parse(req.query.date);
  res.json(await autoPreview(req.auth!.propertyId,date));
});
router.post('/housekeeping/auto-assign/apply',async(req,res)=>{
  const b=z.object({date:businessDate,expectedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
    expectedRulesVersion:z.number().int().min(0),confirm:z.literal('APPROVE')}).strict().parse(req.body);
  const propertyId=req.auth!.propertyId;
  const review=await autoPreview(propertyId,b.date);
  if(!review.canApply||review.fingerprint!==b.expectedFingerprint||review.rulesVersion!==b.expectedRulesVersion)
    throw new HttpError(409,'Assignment preview changed. Refresh and review.');
  await prisma.$transaction(async tx=>{
    for(const task of review.assignments){
      const updated=await tx.cleaningTask.updateMany({where:{id:task.taskId,propertyId,status:'PENDING',assignedToId:null},
        data:{assignedToId:task.employeeId}});
      if(updated.count!==1)throw new HttpError(409,'Task changed while assigning');
      await tx.notification.create({data:{propertyId,userId:task.employeeId,type:'TASK_ASSIGNED',
        title:'Cleaning assignment',message:'Room '+task.room+' was assigned to you.',entityId:task.taskId}});
      await tx.auditLog.create({data:{propertyId,actorId:req.auth!.userId,entityType:'CleaningTask',
        entityId:task.taskId,action:'ASSIGN',after:{assignedToId:task.employeeId}}});
    }
  },{isolationLevel:'Serializable',timeout:30000});
  res.json({assigned:review.assignments.length,rulesVersion:review.rulesVersion});
});
export default router;
