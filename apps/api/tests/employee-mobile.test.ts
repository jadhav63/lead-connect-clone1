import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID,randomBytes} from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import {app} from '../src/app.js';
import {prisma} from '../src/lib/db.js';
import {accessToken,hashToken} from '../src/lib/tokens.js';
import {login,rotateRefresh} from '../src/services/auth.js';
import {redeemAccessGrant} from '../src/services/employee-access.js';
const properties=[randomUUID(),randomUUID()],users:Record<string,string>={},tokens:Record<string,string>={},emails:Record<string,string>={};
const password=randomBytes(32).toString('hex'),replacement=randomBytes(32).toString('hex');
let profileId='',workerProfile='',invitedUser='',activation='',workerRoomTask='',workerAreaTask='',otherRoomTask='',workerRefresh='',code='';
const api=(role:string)=>({get:(p:string)=>request(app).get('/api'+p).set('Authorization','Bearer '+tokens[role]),post:(p:string,b:unknown)=>request(app).post('/api'+p).set('Authorization','Bearer '+tokens[role]).send(b),patch:(p:string,b:unknown)=>request(app).patch('/api'+p).set('Authorization','Bearer '+tokens[role]).send(b)});
beforeAll(async()=>{
  for(const p of properties)await prisma.property.create({data:{id:p,name:'Fictional mobile hotel',code:'MOBILE-'+p,timezone:'America/Phoenix'}});code='MOBILE-'+properties[0];
  const hash=await argon2.hash(password);
  for(const [key,role,n] of [['manager','MANAGER',0],['worker','HOUSEKEEPING',0],['otherWorker','HOUSEKEEPING',0],['foreign','MANAGER',1]] as const){
    const email=randomUUID()+'@example.test';const u=await prisma.user.create({data:{name:'Fictional '+key,email,passwordHash:hash,memberships:{create:{propertyId:properties[n],role}}}});users[key]=u.id;emails[key]=email;tokens[key]=accessToken(u.id,properties[n]);
  }
  const session=await login(emails.worker,password,code);tokens.worker=session.accessToken;workerRefresh=session.refreshToken;
  const day=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Phoenix'}).format(new Date())+'T00:00:00Z');
  for(const [n,key] of ['worker','otherWorker','foreign'].entries()){
    const propertyId=key==='foreign'?properties[1]:properties[0];const room=await prisma.room.create({data:{propertyId,number:String(901+n),floor:1,status:'DIRTY',occupancyStatus:'DEPARTURE'}});
    const task=await prisma.cleaningTask.create({data:{propertyId,roomId:room.id,assignedToId:users[key],createdById:users.manager,cleaningType:'CHECKOUT',scheduledFor:day,instructions:'Fictional private instructions '+key}});
    if(key==='worker')workerRoomTask=task.id;if(key==='otherWorker')otherRoomTask=task.id;
  }
  const a=await prisma.publicArea.create({data:{propertyId:properties[0],name:'Fictional mobile lobby',location:'Ground',department:'Housekeeping',checklist:['Wipe','Sweep'],assignedToId:users.worker}});
  const task=await prisma.publicAreaTask.create({data:{propertyId:properties[0],areaId:a.id,assignedToId:users.worker,createdById:users.manager,scheduledFor:day,checklist:a.checklist,completedItems:[]}});workerAreaTask=task.id;
});
afterAll(async()=>{
  const scope={propertyId:{in:properties}},rooms=await prisma.room.findMany({where:scope,select:{id:true}});
  await prisma.employeeAccessGrant.deleteMany({where:scope});await prisma.publicAreaTask.deleteMany({where:scope});await prisma.publicArea.deleteMany({where:scope});
  await prisma.cleaningTask.deleteMany({where:scope});await prisma.roomStatusEvent.deleteMany({where:{roomId:{in:rooms.map(r=>r.id)}}});await prisma.room.deleteMany({where:scope});
  await prisma.staffDirectoryEntry.deleteMany({where:scope});await prisma.auditLog.deleteMany({where:scope});await prisma.notification.deleteMany({where:scope});await prisma.refreshToken.deleteMany({where:scope});
  await prisma.propertyMembership.deleteMany({where:scope});await prisma.user.deleteMany({where:{id:{in:[...Object.values(users),invitedUser].filter(Boolean)}}});await prisma.property.deleteMany({where:{id:{in:properties}}});await prisma.$disconnect();
});
describe('mobile employee work and approved individual access',()=>{
  it('returns only the authenticated employee’s assigned rooms and areas for the property business date',async()=>{
    const r=await api('worker').get('/my-work?userId='+users.otherWorker+'&propertyId='+properties[1]);expect(r.status).toBe(200);
    expect(r.body.rooms.map((x:any)=>x.id)).toEqual([workerRoomTask]);expect(r.body.areas.map((x:any)=>x.id)).toEqual([workerAreaTask]);
    expect(r.body).toMatchObject({property:{code,timezone:'America/Phoenix'},roomTotals:{completed:0,remaining:1},areaTotals:{completed:0,remaining:1}});
    expect((await api('foreign').get('/my-work')).body.rooms.map((x:any)=>x.id)).not.toContain(workerRoomTask);
    expect((await api('worker').patch('/housekeeping/'+otherRoomTask,{status:'IN_PROGRESS'})).status).toBe(403);
  });
  it('starts and completes rooms without duplicate completion and shows supervisor inspection status',async()=>{
    expect((await api('worker').patch('/housekeeping/'+workerRoomTask,{status:'IN_PROGRESS'})).body.startedAt).toBeTruthy();
    const done=await api('worker').patch('/housekeeping/'+workerRoomTask,{status:'COMPLETED'});expect(done.status).toBe(200);expect(done.body.completedAt).toBeTruthy();
    expect((await api('worker').patch('/housekeeping/'+workerRoomTask,{status:'COMPLETED'})).status).toBe(409);
    expect((await api('worker').patch('/housekeeping/'+workerRoomTask,{status:'VERIFIED'})).status).toBe(403);
    expect((await api('manager').patch('/housekeeping/'+workerRoomTask,{status:'VERIFIED'})).status).toBe(200);
    const today=(await api('worker').get('/my-work')).body;expect(today.roomTotals).toMatchObject({completed:1,remaining:0,verified:1});expect(today.rooms[0].verifiedAt).toBeTruthy();
  });
  it('keeps area checklist, completion and independent verification separate from room work',async()=>{
    expect((await api('worker').patch('/public-area-tasks/'+workerAreaTask,{status:'IN_PROGRESS'})).status).toBe(200);
    expect((await api('worker').patch('/public-area-tasks/'+workerAreaTask,{completedItems:['Wipe'],notes:'Fictional progress'})).status).toBe(200);
    expect((await api('worker').patch('/public-area-tasks/'+workerAreaTask,{status:'COMPLETED',completedItems:['Wipe','Sweep']})).status).toBe(200);
    expect((await api('manager').patch('/public-area-tasks/'+workerAreaTask,{status:'VERIFIED'})).status).toBe(200);
    expect((await api('worker').get('/my-work')).body.areaTotals).toMatchObject({completed:1,remaining:0,verified:1});
  });
  it('allows manager reassignment of unfinished room and area work and resets old start/checklist evidence',async()=>{
    const roomStart=await api('otherWorker').patch('/housekeeping/'+otherRoomTask,{status:'IN_PROGRESS'});expect(roomStart.status).toBe(200);
    const reassigned=await api('manager').patch('/housekeeping/'+otherRoomTask,{assignedToId:users.worker});expect(reassigned.body).toMatchObject({status:'PENDING',startedAt:null,assignedToId:users.worker});
    const a=await prisma.publicArea.findFirstOrThrow({where:{propertyId:properties[0]}});
    const day=(await api('worker').get('/my-work')).body.businessDate;
    const created=await api('manager').post('/public-areas/'+a.id+'/tasks',{date:day,slot:2});expect(created.status).toBe(201);
    await api('worker').patch('/public-area-tasks/'+created.body.id,{status:'IN_PROGRESS'});
    await api('worker').patch('/public-area-tasks/'+created.body.id,{completedItems:['Wipe']});
    const moved=await api('manager').patch('/public-area-tasks/'+created.body.id,{assignedToId:users.otherWorker});expect(moved.body).toMatchObject({status:'PENDING',startedAt:null,completedItems:[],assignedToId:users.otherWorker});
    expect((await api('worker').get('/my-work')).body.areas.map((x:any)=>x.id)).not.toContain(created.body.id);
  });
  it('links only approved profiles to existing active accounts in the same property',async()=>{
    const p=await api('manager').post('/staff-directory',{name:'Fictional linked worker',employmentStatus:'ACTIVE'});workerProfile=p.body.id;
    expect((await api('worker').post('/employee-access/'+workerProfile+'/link',{userId:users.worker,identityConfirmed:true})).status).toBe(403);
    expect((await api('foreign').post('/employee-access/'+workerProfile+'/link',{userId:users.foreign,identityConfirmed:true})).status).toBe(404);
    expect((await api('manager').post('/employee-access/'+workerProfile+'/link',{userId:users.foreign,identityConfirmed:true})).status).toBe(400);
    expect((await api('manager').post('/employee-access/'+workerProfile+'/link',{userId:users.worker,identityConfirmed:true})).status).toBe(200);
  });
  it('creates a pending individual enrollment only after employment and identity approval',async()=>{
    const p=await api('manager').post('/staff-directory',{name:'Fictional mobile invitation'});profileId=p.body.id;const email=randomUUID()+'@example.test';emails.invited=email;
    const body={email,role:'HOUSEKEEPING',identityConfirmed:true};
    expect((await api('manager').post('/employee-access/'+profileId+'/invitation',body)).status).toBe(409);
    await api('manager').patch('/staff-directory/'+profileId,{employmentStatus:'ACTIVE'});
    expect((await api('manager').post('/employee-access/'+profileId+'/invitation',{...body,identityConfirmed:false})).status).toBe(400);
    expect((await api('manager').post('/employee-access/'+profileId+'/invitation',{...body,role:'MANAGER'})).status).toBe(403);
    const r=await api('manager').post('/employee-access/'+profileId+'/invitation',body);expect(r.status).toBe(201);activation=r.body.code;
    const profile=await prisma.staffDirectoryEntry.findUniqueOrThrow({where:{id:profileId}});invitedUser=profile.userId!;expect(profile.appAccessEnabled).toBe(false);
    expect(await prisma.propertyMembership.count({where:{propertyId:properties[0],userId:invitedUser,isActive:true}})).toBe(0);
    const stored=await prisma.employeeAccessGrant.findUniqueOrThrow({where:{tokenHash:hashToken(activation)}});expect(stored.tokenHash).not.toBe(activation);
    await expect(login(email,password,code)).rejects.toThrow('Invalid credentials');
  });
  it('redeems enrollment once, keeps the password private and restores an individual cookie session',async()=>{
    const r=await request(app).post('/api/auth/redeem-access').send({code:activation,password:replacement});expect(r.status).toBe(204);
    expect((await request(app).post('/api/auth/redeem-access').send({code:activation,password:replacement})).status).toBe(401);
    const result=await request(app).post('/api/auth/login').send({email:emails.invited,password:replacement,propertyCode:code});expect(result.status).toBe(200);tokens.invited=result.body.accessToken;
    expect(result.body.refreshToken).toBeUndefined();expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    const restored=await request(app).post('/api/auth/refresh').set('Cookie',result.headers['set-cookie'][0].split(';')[0]).send({});expect(restored.status).toBe(200);
    expect((await prisma.staffDirectoryEntry.findUniqueOrThrow({where:{id:profileId}})).appAccessEnabled).toBe(true);
  });
  it('recovers with a hashed, expiring single-use code and immediately invalidates old access/refresh sessions',async()=>{
    const r=await api('manager').post('/employee-access/'+workerProfile+'/recovery',{identityConfirmed:true});expect(r.status).toBe(201);
    expect((await api('worker').get('/my-work')).status).toBe(401);await expect(rotateRefresh(workerRefresh)).rejects.toThrow('Invalid session');
    await redeemAccessGrant(r.body.code,replacement);
    await expect(redeemAccessGrant(r.body.code,password)).rejects.toThrow('invalid or expired');
    await expect(login(emails.worker,password,code)).rejects.toThrow('Invalid credentials');const session=await login(emails.worker,replacement,code);tokens.worker=session.accessToken;
    expect((await api('worker').get('/my-work')).status).toBe(200);
    const expired=await api('manager').post('/employee-access/'+workerProfile+'/recovery',{identityConfirmed:true});await prisma.employeeAccessGrant.update({where:{tokenHash:hashToken(expired.body.code)},data:{expiresAt:new Date(0)}});
    await expect(redeemAccessGrant(expired.body.code,password)).rejects.toThrow('invalid or expired');
    const audit=JSON.stringify(await prisma.auditLog.findMany({where:{propertyId:properties[0]}}));expect(audit).not.toContain(replacement);expect(audit).not.toContain(activation);expect(audit).not.toContain(r.body.code);
  });
  it('deactivates immediately, blocks legacy reactivation bypass, and keeps old tokens invalid after fresh activation',async()=>{
    const previous=tokens.invited;
    expect((await api('manager').patch('/employee-access/'+profileId,{isActive:false,identityConfirmed:true})).status).toBe(200);
    expect((await api('invited').get('/my-work')).status).toBe(401);await expect(login(emails.invited,replacement,code)).rejects.toThrow('Invalid credentials');
    const membership=await prisma.propertyMembership.findFirstOrThrow({where:{propertyId:properties[0],userId:invitedUser}});
    expect((await api('manager').patch('/employees/'+membership.id,{isActive:true})).status).toBe(409);
    const fresh=await api('manager').post('/employee-access/'+profileId+'/invitation',{email:emails.invited,role:'HOUSEKEEPING',identityConfirmed:true});expect(fresh.status).toBe(201);await redeemAccessGrant(fresh.body.code,replacement);
    expect((await request(app).get('/api/my-work').set('Authorization','Bearer '+previous)).status).toBe(401);
    const session=await login(emails.invited,replacement,code);tokens.invited=session.accessToken;expect((await api('invited').get('/my-work')).status).toBe(200);
    expect((await api('manager').patch('/employee-access/'+profileId,{isActive:true,role:'MANAGER',identityConfirmed:true})).status).toBe(403);
  });
  it('revokes linked access when employment is marked inactive, and rejects cross-origin code redemption',async()=>{
    expect((await request(app).post('/api/auth/redeem-access').set('Origin','https://hostile.example.test').send({code:activation,password})).status).toBe(403);
    expect((await api('manager').patch('/staff-directory/'+profileId,{employmentStatus:'INACTIVE'})).status).toBe(200);
    expect((await api('invited').get('/my-work')).status).toBe(401);
    expect((await prisma.staffDirectoryEntry.findUniqueOrThrow({where:{id:profileId}})).appAccessEnabled).toBe(false);
  });
});
