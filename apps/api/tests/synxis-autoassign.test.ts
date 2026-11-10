import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { extractSynxisPdf } from '../src/services/synxis-pdf.js';
import { buildAssignmentPlan } from '../src/services/housekeeping-planner.js';
import { defaultHousekeepingRules } from '../src/routes/housekeeping-rules.js';

function block(x:number,y:number,text:string){
  return 'BT\n/F1 10 Tf\n'+x+'. '+y+'. Td\n('+text+') Tj\nET\n';
}
function fixture() {
  const lines=[block(45,550,'91952-Tombstone Grand Hotel, a Baymont by Wyndham')];
  for(const [n,y,type,hk,occ,guest,pet] of [
    ['100',500,'RM2','Dirty','Vacant','Checked Out',false],
    ['101',478,'RM3','Dirty','Occupied','Stay Overs',true],
  ] as const){
    lines.push(block(45,y,n),block(115,y,type),block(190,y,hk),
      block(280,y,occ),block(360,y,guest),block(440,y,'Nov 07'),block(515,y,'Nov 10'));
    if(pet)lines.push(block(280,y-11.5,'Pet In Room'));
  }
  lines.push(block(600,60,'11/10/2026 01:00:00 AM  Page 1 of 1'));
  const compressed=deflateSync(Buffer.from(lines.join(''),'latin1'));
  return Buffer.concat([Buffer.from('%PDF-1.7\n1 0 obj\n<</Filter/FlateDecode>>stream\r\n'),
    compressed,Buffer.from('\r\nendstream\nendobj\n%%EOF')]);
}
describe('SynXis PDF Room List extraction',()=>{
  it('extracts room, type, housekeeping, occupancy, pet and printed date',()=>{
    const result=extractSynxisPdf(fixture());
    expect(result.rooms).toHaveLength(2);
    expect(result.duplicates).toEqual([]);
    expect(result.reportDate).toBe('2026-11-10');
    expect(result.rooms[0]).toMatchObject({number:'100',roomType:'RM2',hkStatus:'DIRTY',
      occupancyStatus:'VACANT',guestStatus:'Checked Out',pet:false});
    expect(result.rooms[1]).toMatchObject({number:'101',roomType:'RM3',pet:true});
  });
  it('rejects non-PDF uploads',()=>expect(()=>extractSynxisPdf(Buffer.from('not a pdf'))).toThrow());
});
describe('configurable, deterministic room assignment',()=>{
  const staff=[{id:'a',name:'Angie'},{id:'b',name:'Johana'}];
  const tasks=[
    {id:'1',roomNumber:'100',floor:1,cleaningType:'CHECKOUT',notes:'Pet In Room',assignedToId:null,status:'PENDING'},
    {id:'2',roomNumber:'101',floor:1,cleaningType:'CHECKOUT',notes:null,assignedToId:null,status:'PENDING'},
    {id:'3',roomNumber:'201',floor:2,cleaningType:'STAYOVER',notes:null,assignedToId:null,status:'PENDING'},
    {id:'4',roomNumber:'205',floor:2,cleaningType:'STAYOVER',notes:null,assignedToId:'a',status:'IN_PROGRESS'},
  ];
  it('uses saved minute settings and preserves assigned work',()=>{
    const rules={...defaultHousekeepingRules,minutes:{...defaultHousekeepingRules.minutes,petCheckout:50}};
    const result=buildAssignmentPlan(tasks,staff,rules);
    expect(result.assignments).toHaveLength(3);
    expect(result.assignments[0]).toMatchObject({room:'100',minutes:50});
    expect(result.assignments.some(x=>x.room==='205')).toBe(false);
    expect(result.unassigned).toBe(0);
    expect(new Set(result.assignments.map(x=>x.taskId)).size).toBe(3);
  });
  it('never assigns started or completed unassigned work',()=>{
    const data=tasks.map(x=>({...x,status:x.id==='1'?'IN_PROGRESS':x.status}));
    expect(buildAssignmentPlan(data,staff,defaultHousekeepingRules).assignments.some(x=>x.taskId==='1')).toBe(false);
  });
});
