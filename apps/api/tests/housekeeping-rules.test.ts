import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/db.js';
import { accessToken } from '../src/lib/tokens.js';

const ids = [randomUUID(), randomUUID()];
const actors = { manager: '', front: '', otherManager: '' };
const tokens = { manager: '', front: '', otherManager: '' };
function call(who: keyof typeof tokens) {
  const bearer = 'Bearer ' + tokens[who];
  return {
    get:(path:string)=>request(app).get('/api'+path).set('Authorization',bearer),
    put:(path:string,body:unknown)=>request(app).put('/api'+path).set('Authorization',bearer).send(body),
    post:(path:string,body:unknown)=>request(app).post('/api'+path).set('Authorization',bearer).send(body),
  };
}
const path='/settings/housekeeping-rules';
beforeAll(async()=>{
  for (const id of ids) await prisma.property.create({data:{id,name:'Fictional housekeeping rules test',code:'RULES-'+id}});
  const hash=await argon2.hash(randomBytes(32));
  for(const [key,role,prop] of [['manager','MANAGER',0],['front','FRONT_DESK',0],['otherManager','MANAGER',1]] as const){
    const user=await prisma.user.create({data:{name:key,email:randomUUID()+'@example.test',passwordHash:hash,memberships:{create:{propertyId:ids[prop],role}}}});
    actors[key]=user.id;tokens[key]=accessToken(user.id,ids[prop]);
  }
});
afterAll(async()=>{
  const scope={propertyId:{in:ids}};
  await prisma.auditLog.deleteMany({where:scope});
  await prisma.housekeepingRuleVersion.deleteMany({where:scope});
  await prisma.propertyMembership.deleteMany({where:scope});
  await prisma.user.deleteMany({where:{id:{in:Object.values(actors)}}});
  await prisma.property.deleteMany({where:{id:{in:ids}}});
  await prisma.$disconnect();
});
describe('housekeeping settings are property scoped and safely versioned',()=>{
  it('serves defaults without writing records',async()=>{
    const result=await call('manager').get(path);
    expect(result.status).toBe(200);
    expect(result.body.version).toBe(0);
    expect(result.body.settings.minutes.checkout).toBe(30);
    expect(await prisma.housekeepingRuleVersion.count({where:{propertyId:ids[0]}})).toBe(0);
  });
  it('restricts settings to manager roles',async()=>{
    expect((await call('front').get(path)).status).toBe(403);
    expect((await call('front').put(path,{expectedVersion:0,settings:{}})).status).toBe(403);
    expect((await request(app).get('/api'+path)).status).toBe(401);
  });
  it('rejects invalid values, then saves a valid new version',async()=>{
    const original=(await call('manager').get(path)).body.settings;
    expect((await call('manager').put(path,{expectedVersion:0,settings:{...original,minutes:{...original.minutes,checkout:-1}}})).status).toBe(400);
    expect((await call('manager').put(path,{expectedVersion:0,settings:{...original,startTime:'bad'}})).status).toBe(400);
    const changed={...original,minutes:{...original.minutes,checkout:35},startTime:'08:30'};
    const saved=await call('manager').put(path,{expectedVersion:0,settings:changed});
    expect(saved.status).toBe(200); expect(saved.body.version).toBe(1);
    expect((await call('manager').get(path)).body.settings.minutes.checkout).toBe(35);
    expect((await call('manager').put(path,{expectedVersion:0,settings:changed})).status).toBe(409);
  });
  it('keeps another property independent, then restores by creating a new version',async()=>{
    const other=await call('otherManager').get(path);
    expect(other.status).toBe(200);expect(other.body.version).toBe(0);
    const original=(await call('manager').get(path)).body.settings;
    const changed={...original,minutes:{...original.minutes,checkout:40}};
    expect((await call('manager').put(path,{expectedVersion:1,settings:changed})).status).toBe(200);
    const hist=await call('manager').get(path+'/history');
    expect(hist.status).toBe(200);expect(hist.body.map((x:{version:number})=>x.version)).toEqual([2,1]);
    const restored=await call('manager').post(path+'/restore',{version:1,expectedVersion:2});
    expect(restored.status).toBe(200);expect(restored.body.version).toBe(3);
    expect(restored.body.settings.minutes.checkout).toBe(35);
    expect((await call('otherManager').get(path+'/history')).body).toEqual([]);
    expect((await call('otherManager').post(path+'/restore',{version:1,expectedVersion:0})).status).toBe(404);
  });
  it('previews workload without changing assignments',async()=>{
    const current=(await call('manager').get(path)).body.settings;
    const result=await call('manager').post(path+'/preview',current);
    expect(result.status).toBe(200);expect(result.body.tasks).toEqual([]);
    expect(result.body.totalEstimatedMinutes).toBe(0);
  });
});
