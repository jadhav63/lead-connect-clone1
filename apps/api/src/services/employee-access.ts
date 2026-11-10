import argon2 from 'argon2';
import {randomBytes} from 'node:crypto';
import {prisma} from '../lib/db.js';
import type {Prisma} from '../generated/prisma/client.js';
import {hashToken,newRefreshToken} from '../lib/tokens.js';
import {HttpError} from '../lib/errors.js';

export async function revokeEmployeeSessions(tx:Prisma.TransactionClient,userId:string){
  await tx.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});
  await tx.refreshToken.updateMany({where:{userId,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.employeeAccessGrant.updateMany({where:{userId,consumedAt:null},data:{consumedAt:new Date()}});
}
export async function issueAccessGrant(tx:Prisma.TransactionClient,propertyId:string,userId:string,issuedById:string,purpose:'ACTIVATE'|'RECOVER'){
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
  await tx.employeeAccessGrant.updateMany({where:{userId,consumedAt:null},data:{consumedAt:new Date()}});
  const token=newRefreshToken(),expiresAt=new Date(Date.now()+20*60*1000);
  await tx.employeeAccessGrant.create({data:{propertyId,userId,issuedById,purpose,tokenHash:hashToken(token),expiresAt,sessionVersion:user.sessionVersion}});
  await tx.auditLog.create({data:{propertyId,actorId:issuedById,action:'CREATE',entityType:'EmployeeAccessGrant',entityId:userId,after:{purpose}}});
  return {code:token,expiresAt,purpose};
}
export async function redeemAccessGrant(code:string,password:string){
  const passwordHash=await argon2.hash(password,{type:argon2.argon2id});
  await prisma.$transaction(async tx=>{
    const grant=await tx.employeeAccessGrant.findUnique({where:{tokenHash:hashToken(code)}});
    const invalid=()=>new HttpError(401,'Code is invalid or expired; ask your manager for a new code');
    if(!grant || grant.consumedAt || grant.expiresAt<=new Date())throw invalid();
    const user=await tx.user.findUnique({where:{id:grant.userId},include:{memberships:true}});
    const profile=await tx.staffDirectoryEntry.findFirst({where:{propertyId:grant.propertyId,userId:grant.userId,employmentStatus:'ACTIVE'}});
    const memberships=user?.memberships.filter(m=>m.propertyId===grant.propertyId)??[];
    if(!user?.isActive || user.deletedAt || user.sessionVersion!==grant.sessionVersion || !profile || !memberships.length)throw invalid();
    if(user.memberships.some(m=>m.propertyId!==grant.propertyId))throw new HttpError(409,'Multi-property accounts require account-administrator recovery');
    if(grant.purpose==='RECOVER' && !memberships.some(m=>m.isActive))throw invalid();
    const consumed=await tx.employeeAccessGrant.updateMany({where:{id:grant.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
    if(consumed.count!==1)throw invalid();
    await tx.user.update({where:{id:user.id},data:{passwordHash,sessionVersion:{increment:1}}});
    await tx.refreshToken.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.employeeAccessGrant.updateMany({where:{userId:user.id,consumedAt:null},data:{consumedAt:new Date()}});
    if(grant.purpose==='ACTIVATE'){
      await tx.propertyMembership.updateMany({where:{propertyId:grant.propertyId,userId:user.id},data:{isActive:true}});
      await tx.staffDirectoryEntry.update({where:{id:profile.id},data:{appAccessEnabled:true}});
    }
    await tx.auditLog.create({data:{propertyId:grant.propertyId,actorId:user.id,action:'UPDATE',entityType:'EmployeeAccessRedeemed',entityId:user.id,after:{purpose:grant.purpose}}});
  },{isolationLevel:'Serializable'});
}
export const unusablePasswordHash=()=>argon2.hash(randomBytes(48),{type:argon2.argon2id});
