import {Router,type Request} from 'express';
import {z} from 'zod';
import {rateLimit} from 'express-rate-limit';
import {prisma} from '../lib/db.js';
import type {Prisma} from '../generated/prisma/client.js';
import {requireAuth,requireRole} from '../middleware/auth.js';
import {HttpError} from '../lib/errors.js';
import {issueAccessGrant,revokeEmployeeSessions,unusablePasswordHash} from '../services/employee-access.js';
const router=Router();router.use('/employee-access',requireAuth,requireRole('ADMIN','MANAGER'));
const role=z.enum(['HOUSEKEEPING','MAINTENANCE','FRONT_DESK','MANAGER']);
const serial={isolationLevel:'Serializable' as const};
const grantLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false});
async function profile(tx:Prisma.TransactionClient,req:Request){
  const p=await tx.staffDirectoryEntry.findFirst({where:{id:z.uuid().parse(req.params.entryId),propertyId:req.auth!.propertyId}});
  if(!p)throw new HttpError(404,'Staff profile not found');return p;
}
async function protectRole(tx:Prisma.TransactionClient,req:Request,userId:string|null,newRole?:string){
  if(newRole==='MANAGER'&&!req.auth!.roles.includes('ADMIN'))throw new HttpError(403,'Administrator required for manager access');
  if(userId===req.auth!.userId)throw new HttpError(403,'Use another administrator for your own access');
  if(userId&&!req.auth!.roles.includes('ADMIN')&&await tx.propertyMembership.findFirst({where:{propertyId:req.auth!.propertyId,userId,role:{in:['ADMIN','MANAGER']}}}))throw new HttpError(403,'Administrator required for this account');
}
router.post('/employee-access/:entryId/invitation',grantLimiter,async(req,res)=>{
  const body=z.object({email:z.email().max(254),role,identityConfirmed:z.literal(true)}).strict().parse(req.body);
  const passwordHash=await unusablePasswordHash();
  const result=await prisma.$transaction(async tx=>{
    const p=await profile(tx,req);await protectRole(tx,req,p.userId,body.role);
    if(p.employmentStatus!=='ACTIVE')throw new HttpError(409,'Approve the staff profile employment status first');
    let userId=p.userId;
    if(!userId){
      if(await tx.user.findUnique({where:{email:body.email.toLowerCase()}}))throw new HttpError(409,'Email already belongs to an account; link an authorized account in this property instead');
      const u=await tx.user.create({data:{name:p.name,email:body.email.toLowerCase(),passwordHash}});userId=u.id;
      await tx.staffDirectoryEntry.update({where:{id:p.id},data:{userId,appAccessEnabled:false}});
    }else{
      const u=await tx.user.findUniqueOrThrow({where:{id:userId},include:{memberships:true}});
      if(u.email!==body.email.toLowerCase() || u.deletedAt || !u.isActive || u.memberships.some(m=>m.propertyId!==p.propertyId) || u.memberships.some(m=>m.isActive))throw new HttpError(409,'Use recovery for active accounts; multi-property enrollment requires an account administrator');
    }
    await revokeEmployeeSessions(tx,userId);
    await tx.propertyMembership.updateMany({where:{propertyId:p.propertyId,userId},data:{isActive:false}});
    await tx.propertyMembership.upsert({where:{propertyId_userId_role:{propertyId:p.propertyId,userId,role:body.role}},create:{propertyId:p.propertyId,userId,role:body.role,isActive:false},update:{isActive:false}});
    // Only the selected approved role may be activated when the code is redeemed.
    await tx.propertyMembership.deleteMany({where:{propertyId:p.propertyId,userId,role:{not:body.role},isActive:false}});
    return issueAccessGrant(tx,p.propertyId,userId,req.auth!.userId,'ACTIVATE');
  },serial);res.status(201).json(result);
});
router.post('/employee-access/:entryId/link',async(req,res)=>{
  const {userId,identityConfirmed}=z.object({userId:z.uuid(),identityConfirmed:z.literal(true)}).strict().parse(req.body);
  await prisma.$transaction(async tx=>{
    const p=await profile(tx,req);await protectRole(tx,req,userId);
    if(p.userId || p.employmentStatus!=='ACTIVE')throw new HttpError(409,'Use an approved unlinked profile');
    const member=await tx.propertyMembership.findFirst({where:{propertyId:p.propertyId,userId,isActive:true,user:{isActive:true,deletedAt:null}}});
    if(!member)throw new HttpError(400,'Account must already be active in this property');
    await tx.staffDirectoryEntry.update({where:{id:p.id},data:{userId,appAccessEnabled:true}});
    await tx.auditLog.create({data:{propertyId:p.propertyId,actorId:req.auth!.userId,action:'UPDATE',entityType:'EmployeeProfileLink',entityId:p.id,after:{userId}}});
  },serial);res.json({linked:true});
});
router.post('/employee-access/:entryId/recovery',grantLimiter,async(req,res)=>{
  z.object({identityConfirmed:z.literal(true)}).strict().parse(req.body);
  const result=await prisma.$transaction(async tx=>{
    const p=await profile(tx,req);await protectRole(tx,req,p.userId);
    if(!p.userId || !p.appAccessEnabled || p.employmentStatus!=='ACTIVE')throw new HttpError(409,'Active linked employee required');
    const u=await tx.user.findUniqueOrThrow({where:{id:p.userId},include:{memberships:true}});
    if(!u.isActive || u.deletedAt || !u.memberships.some(m=>m.propertyId===p.propertyId&&m.isActive) || u.memberships.some(m=>m.propertyId!==p.propertyId))throw new HttpError(409,'Multi-property or disabled accounts require account-administrator recovery');
    await revokeEmployeeSessions(tx,u.id);
    return issueAccessGrant(tx,p.propertyId,u.id,req.auth!.userId,'RECOVER');
  },serial);res.status(201).json(result);
});
router.patch('/employee-access/:entryId',async(req,res)=>{
  const body=z.object({isActive:z.boolean(),role:role.optional(),identityConfirmed:z.literal(true)}).strict().parse(req.body);
  await prisma.$transaction(async tx=>{
    const p=await profile(tx,req);await protectRole(tx,req,p.userId,body.role);
    if(!p.userId)throw new HttpError(409,'Link or invite an employee account first');
    if(body.isActive && p.employmentStatus!=='ACTIVE')throw new HttpError(409,'Approve employment status first');
    const u=await tx.user.findUniqueOrThrow({where:{id:p.userId},include:{memberships:{where:{propertyId:p.propertyId}}}});
    if(u.deletedAt||!u.isActive||!u.memberships.length)throw new HttpError(409,'Employee account is unavailable');
    if(body.isActive && !p.appAccessEnabled)throw new HttpError(409,'Issue a fresh activation code; reactivation requires the employee to set a private password');
    await revokeEmployeeSessions(tx,p.userId);
    await tx.propertyMembership.updateMany({where:{propertyId:p.propertyId,userId:p.userId},data:{isActive:false}});
    if(body.isActive){const selected=body.role??u.memberships[0].role;await tx.propertyMembership.upsert({where:{propertyId_userId_role:{propertyId:p.propertyId,userId:p.userId,role:selected}},create:{propertyId:p.propertyId,userId:p.userId,role:selected,isActive:true},update:{isActive:true}});}
    await tx.staffDirectoryEntry.update({where:{id:p.id},data:{appAccessEnabled:body.isActive}});
    await tx.auditLog.create({data:{propertyId:p.propertyId,actorId:req.auth!.userId,action:'UPDATE',entityType:'EmployeeAccess',entityId:p.id,after:{isActive:body.isActive,role:body.role??null}}});
  },serial);res.json({saved:true});
});
export default router;
