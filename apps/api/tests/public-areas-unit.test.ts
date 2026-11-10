import {describe,expect,it} from 'vitest';
import {areaInput,recurrenceSlots,assertAreaTransition,areaReport,assertSingleAssignee} from '../src/services/public-areas.js';
describe('public-area recurrence and safety',()=>{
  it('schedules explicit daily, twice daily and weekly slots, never on-demand defaults',()=>{
    const monday=new Date('2026-11-09T00:00:00Z');
    expect(recurrenceSlots('DAILY',1,monday)).toEqual([1]);
    expect(recurrenceSlots('TWICE_DAILY',1,monday)).toEqual([1,2]);
    expect(recurrenceSlots('WEEKLY',1,monday)).toEqual([1]);
    expect(recurrenceSlots('WEEKLY',2,monday)).toEqual([]);
    expect(recurrenceSlots('ON_DEMAND',1,monday)).toEqual([]);
  });
  it('requires explicit area details, bounded unique checklists and only one assignee',()=>{
    expect(areaInput.safeParse({name:'Lobby',location:'Ground',department:'Housekeeping',frequency:'DAILY',checklist:['Sweep','Sweep']}).success).toBe(false);
    expect(areaInput.safeParse({name:'Lobby',location:'Ground',department:'Housekeeping',frequency:'DAILY',checklist:[],propertyId:'foreign'}).success).toBe(false);
    expect(()=>assertSingleAssignee({assignedToId:'one',assignedStaffId:'two'})).toThrow('not both');
  });
  it('requires a full snapshot checklist, legal transitions, assignment and supervisor verification',()=>{
    expect(()=>assertAreaTransition('PENDING','COMPLETED',true,false,[],[])).toThrow('transition');
    expect(()=>assertAreaTransition('IN_PROGRESS','COMPLETED',false,true,['Sweep'],[])).toThrow('every');
    expect(()=>assertAreaTransition('IN_PROGRESS','COMPLETED',false,true,['Sweep'],['Sweep'])).not.toThrow();
    expect(()=>assertAreaTransition('COMPLETED','VERIFIED',false,true,[],[])).toThrow('Supervisor');
    expect(()=>assertAreaTransition('PENDING','IN_PROGRESS',false,false,[],[])).toThrow('assigned');
    expect(()=>assertAreaTransition('VERIFIED','IN_PROGRESS',true,false,[],[])).toThrow('transition');
  });
  it('reports area productivity and missed work separately from room totals',()=>{
    const day=new Date('2026-11-09T00:00:00Z');
    const base={scheduledFor:day,assignedToId:'cleaner',assignedStaffId:null,startedAt:new Date('2026-11-09T10:00:00Z'),completedAt:new Date('2026-11-09T10:15:00Z'),verifiedAt:null};
    const result=areaReport([{...base,status:'VERIFIED'},{...base,status:'PENDING',startedAt:null,completedAt:null},{...base,status:'PENDING',scheduledFor:new Date('2026-11-08T00:00:00Z'),startedAt:null,completedAt:null}],day);
    expect(result).toMatchObject({assigned:2,completed:1,pending:1,verified:1,missed:1});
    expect(result.productivity[0]).toMatchObject({employeeId:'cleaner',assigned:2,completed:1,minutes:15});
    expect(result).not.toHaveProperty('rooms');
  });
});
