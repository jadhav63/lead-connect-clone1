import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {app} from '../src/app.js';
import {prisma} from '../src/lib/db.js';
import {accessToken} from '../src/lib/tokens.js';
const properties=[randomUUID(),randomUUID()];
const users:Record<string,string>={},tokens:Record<string,string>={};
let areaId='',foreignArea='',taskId='',staffId='';
const day='2026-11-09';
const api=(role:string)=>({get:(p:string)=>request(app).get('/api'+p).set('Authorization','Bearer '+tokens[role]),post:(p:string,b:unknown)=>request(app).post('/api'+p).set('Authorization','Bearer '+tokens[role]).send(b),patch:(p:string,b:unknown)=>request(app).patch('/api'+p).set('Authorization','Bearer '+tokens[role]).send(b)});
const areaBody={name:'Fictional lobby',location:'Ground floor',department:'Housekeeping',frequency:'TWICE_DAILY',checklist:['Sweep','Wipe desk']};
beforeAll(async()=>{
  for(const id of properties)await prisma.property.create({data:{id,code:'AREA-TEST-'+id,name:'Fictional area test hotel',timezone:'America/Phoenix'}});
  for(const [role,dbRole,index] of [['manager','MANAGER',0],['supervisor','MANAGER',0],['cleaner','HOUSEKEEPING',0],['other','MANAGER',1]] as const){
    const u=await prisma.user.create({data:{name:'Fictional '+role,email:randomUUID()+'@example.test',passwordHash:'test-fixture-no-login',memberships:{create:{propertyId:properties[index],role:dbRole}}}});users[role]=u.id;tokens[role]=accessToken(u.id,properties[index]);
  }
});
afterAll(async()=>{
  const scope={propertyId:{in:properties}};
  const tickets=await prisma.maintenanceTicket.findMany({where:scope,select:{id:true}});
  await prisma.ticketEvent.deleteMany({where:{ticketId:{in:tickets.map(t=>t.id)}}});
  await prisma.maintenanceTicket.deleteMany({where:scope});
  await prisma.publicAreaTask.deleteMany({where:scope});await prisma.publicArea.deleteMany({where:scope});
  await prisma.staffDirectoryEntry.deleteMany({where:scope});await prisma.notification.deleteMany({where:scope});await prisma.auditLog.deleteMany({where:scope});
  await prisma.propertyMembership.deleteMany({where:scope});await prisma.user.deleteMany({where:{id:{in:Object.values(users)}}});await prisma.property.deleteMany({where:{id:{in:properties}}});await prisma.$disconnect();
});
describe('property-scoped public areas with disposable fictional fixtures',()=>{
  it('rejects anonymous and worker configuration writes, and creates no default areas',async()=>{
    expect((await request(app).get('/api/public-areas')).status).toBe(401);
    expect((await api('manager').get('/public-areas')).body).toEqual([]);
    expect((await api('cleaner').post('/public-areas',areaBody)).status).toBe(403);
    const created=await api('manager').post('/public-areas',{...areaBody,assignedToId:users.cleaner});expect(created.status).toBe(201);areaId=created.body.id;
    const foreign=await api('other').post('/public-areas',areaBody);expect(foreign.status).toBe(201);foreignArea=foreign.body.id;
  });
  it('isolates creation, editing, reorder and history by authenticated property, not request IDs',async()=>{
    expect((await api('manager').get('/public-areas')).body.map((x:any)=>x.id)).toEqual([areaId]);
    expect((await api('other').patch('/public-areas/'+areaId,{name:'Wrong tenant'})).status).toBe(404);
    expect((await api('manager').post('/public-areas/reorder',{ids:[foreignArea]})).status).toBe(409);
    expect((await api('other').get('/public-areas/'+areaId+'/history')).status).toBe(404);
    expect((await api('manager').post('/public-areas',{...areaBody,propertyId:properties[1]})).status).toBe(400);
    expect((await api('manager').patch('/public-areas/'+areaId,{notes:'Fictional checklist area'})).status).toBe(200);
  });
  it('preserves no-email directory profiles without accounts and rejects cross-tenant assignees',async()=>{
    const entry=await api('manager').post('/staff-directory',{name:'Fictional no login',employmentStatus:'ACTIVE',department:'Laundry'});expect(entry.status).toBe(201);staffId=entry.body.id;
    expect(entry.body).toMatchObject({email:null,appAccessEnabled:false});
    expect(await prisma.user.count({where:{id:staffId}})).toBe(0);
    expect((await api('manager').patch('/staff-directory/'+staffId,{appAccessEnabled:true})).status).toBe(400);
    expect((await api('manager').patch('/public-areas/'+areaId,{assignedToId:users.other})).status).toBe(400);
    expect((await api('other').patch('/public-areas/'+foreignArea,{assignedStaffId:staffId})).status).toBe(400);
  });
  it('materializes recurring daily slots idempotently and snapshots checklists',async()=>{
    expect((await api('cleaner').post('/public-area-tasks/prepare',{from:day,to:day})).status).toBe(403);
    expect((await api('manager').post('/public-area-tasks/prepare',{from:day,to:day})).body.created).toBe(2);
    expect((await api('manager').post('/public-area-tasks/prepare',{from:day,to:day})).body.created).toBe(0);
    const tasks=await api('manager').get('/public-area-tasks?date='+day);expect(tasks.body).toHaveLength(2);taskId=tasks.body[0].id;
    await api('manager').patch('/public-areas/'+areaId,{checklist:['New future checklist']});
    expect((await api('manager').get('/public-area-tasks?date='+day)).body[0].checklist).toEqual(['Sweep','Wipe desk']);
    expect((await api('other').get('/public-area-tasks?date='+day)).body).toEqual([]);
    expect((await api('manager').post('/public-area-tasks/prepare',{from:day,to:'2026-12-20'})).status).toBe(400);
  });
  it('enforces assignment, complete checklist, timestamps, independent supervisor and closed task immutability',async()=>{
    expect((await api('other').patch('/public-area-tasks/'+taskId,{status:'IN_PROGRESS'})).status).toBe(404);
    expect((await api('cleaner').patch('/public-area-tasks/'+taskId,{assignedToId:users.manager})).status).toBe(403);
    const start=await api('cleaner').patch('/public-area-tasks/'+taskId,{status:'IN_PROGRESS'});expect(start.status).toBe(200);expect(start.body.startedAt).toBeTruthy();
    expect((await api('cleaner').patch('/public-area-tasks/'+taskId,{status:'COMPLETED',completedItems:['Sweep']})).status).toBe(400);
    const done=await api('cleaner').patch('/public-area-tasks/'+taskId,{status:'COMPLETED',completedItems:['Sweep','Wipe desk'],notes:'Fictional clean'});expect(done.status).toBe(200);expect(done.body.completedAt).toBeTruthy();
    expect((await api('cleaner').patch('/public-area-tasks/'+taskId,{status:'VERIFIED'})).status).toBe(403);
    const verified=await api('manager').patch('/public-area-tasks/'+taskId,{status:'VERIFIED'});expect(verified.status).toBe(200);expect(verified.body).toMatchObject({verifiedById:users.manager,status:'VERIFIED'});expect(verified.body.verifiedAt).toBeTruthy();
    expect((await api('manager').patch('/public-area-tasks/'+taskId,{notes:'overwrite'})).status).toBe(409);
    const remaining=(await api('manager').get('/public-area-tasks?date='+day)).body.find((t:any)=>t.id!==taskId);
    await api('manager').patch('/public-area-tasks/'+remaining.id,{status:'IN_PROGRESS'});
    await api('manager').patch('/public-area-tasks/'+remaining.id,{status:'COMPLETED',completedItems:['Sweep','Wipe desk']});
    expect((await api('manager').patch('/public-area-tasks/'+remaining.id,{status:'VERIFIED'})).status).toBe(403);
    expect((await api('supervisor').patch('/public-area-tasks/'+remaining.id,{status:'VERIFIED'})).status).toBe(200);
  });
  it('links maintenance without making a room and keeps reports and history property-scoped',async()=>{
    const ticket=await api('cleaner').post('/public-areas/'+areaId+'/maintenance',{title:'Fictional light',description:'Fictional repair needed'});expect(ticket.status).toBe(201);expect(ticket.body).toMatchObject({publicAreaId:areaId,roomId:null});
    expect((await api('other').post('/public-areas/'+areaId+'/maintenance',{title:'Wrong',description:'Wrong tenant'})).status).toBe(404);
    const report=await api('manager').get('/public-area-reports?date='+day);expect(report.status).toBe(200);expect(report.body).toMatchObject({assigned:2,completed:2,verified:2,pending:0});expect(report.body.maintenanceIssues).toHaveLength(1);
    expect((await api('other').get('/public-area-reports?date='+day)).body.maintenanceIssues).toEqual([]);
    expect((await api('cleaner').get('/public-area-reports?date='+day)).status).toBe(403);
    expect((await api('manager').get('/public-areas/'+areaId+'/history')).body).toHaveLength(2);
    expect((await api('manager').get('/reports?date='+day)).body).toMatchObject({completed:0,verified:0,cleaningTasks:[]});
    expect(await prisma.room.count({where:{propertyId:properties[0]}})).toBe(0);
    expect(await prisma.auditLog.count({where:{propertyId:properties[0],entityType:'PublicAreaTask'}})).toBeGreaterThan(0);
    expect(await prisma.notification.count({where:{propertyId:properties[0],userId:users.cleaner}})).toBeGreaterThan(0);
  });
  it('reports missed tasks and deactivates future pending work without deleting history',async()=>{
    await api('manager').post('/public-area-tasks/prepare',{from:'2026-11-08',to:'2026-11-08'});
    expect((await api('manager').get('/public-area-reports?date='+day)).body.missed).toBe(2);
    const future='2099-01-01';await api('manager').post('/public-area-tasks/prepare',{from:future,to:future});
    expect((await api('manager').patch('/public-areas/'+areaId,{isActive:false})).status).toBe(200);
    expect((await api('manager').get('/public-area-tasks?date='+future)).body.every((t:any)=>t.status==='CANCELLED')).toBe(true);
    expect((await api('cleaner').get('/public-areas')).body).toEqual([]);
    expect((await api('manager').post('/public-areas/'+areaId+'/tasks',{date:day})).status).toBe(409);
    expect((await api('manager').get('/public-areas/'+areaId+'/history')).body).toHaveLength(6);
  });
});
