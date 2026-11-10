import type { HousekeepingRules } from '../routes/housekeeping-rules.js';

export type PlanTask={
  id:string;roomNumber:string;floor:number;cleaningType:string;notes:string|null;
  assignedToId:string|null;status:string;
};
export type PlanEmployee={id:string;name:string;department?:string|null};
export function calculateMinutes(task:PlanTask,rules:HousekeepingRules){
  const times:Record<string,number>={CHECKOUT:rules.minutes.checkout,STAYOVER:rules.minutes.stayover,
    FULL_SERVICE:rules.minutes.fullService,DEEP_CLEAN:rules.minutes.deepClean,ARRIVAL_TOUCHUP:rules.minutes.arrivalTouchup};
  return task.cleaningType==='CHECKOUT'&&/pet in room/i.test(task.notes??'')
    ?rules.minutes.petCheckout:times[task.cleaningType]??0;
}
export function buildAssignmentPlan(tasks:PlanTask[],staff:PlanEmployee[],rules:HousekeepingRules){
  const available=staff.slice().sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const load=new Map(available.map(e=>[e.id,{minutes:0,floor:0,rooms:0}]));
  // Keep already assigned work in capacity calculations. Never reassign started/completed jobs.
  for(const t of tasks)if(t.assignedToId&&load.has(t.assignedToId)){
    const e=load.get(t.assignedToId)!;e.minutes+=calculateMinutes(t,rules);e.rooms++;e.floor=t.floor;
  }
  const rank=(t:PlanTask)=>t.cleaningType==='CHECKOUT'?'CHECKOUT':
    t.cleaningType==='ARRIVAL_TOUCHUP'?'ARRIVAL':'STAYOVER';
  const ordered=tasks.filter(t=>t.status==='PENDING'&&!t.assignedToId).sort((a,b)=>
    rules.priority.indexOf(rank(a))-rules.priority.indexOf(rank(b))||
    (rules.startOnFirstFloor?a.floor-b.floor:0)||Number(a.roomNumber)-Number(b.roomNumber));
  const planned:{taskId:string;room:string;floor:number;employeeId:string;employee:string;minutes:number;service:string}[]=[];
  for(const task of ordered){
    if(!available.length)break;
    const laundry=available.filter(e=>e.department==='Laundry');
    const regular=available.filter(e=>e.department!=='Laundry');
    const eligible=task.cleaningType==='STAYOVER'&&rules.lightStayoversToLaundry&&laundry.length?laundry:(regular.length?regular:available);
    const person=eligible.slice().sort((a,b)=>{
      const la=load.get(a.id)!,lb=load.get(b.id)!;
      const aa=rules.balanceMinutes?la.minutes:la.rooms*20;
      const bb=rules.balanceMinutes?lb.minutes:lb.rooms*20;
      const fa=rules.groupFloors&&la.rooms>0&&la.floor===task.floor?Math.min(la.rooms*5,20):0;
      const fb=rules.groupFloors&&lb.rooms>0&&lb.floor===task.floor?Math.min(lb.rooms*5,20):0;
      return (aa-fa)-(bb-fb)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
    })[0];
    const minutes=calculateMinutes(task,rules);
    planned.push({taskId:task.id,room:task.roomNumber,floor:task.floor,employeeId:person.id,
      employee:person.name,minutes,service:task.cleaningType});
    const l=load.get(person.id)!;
    if(l.rooms===0)l.minutes+=rules.minutes.cartSetup;
    if(l.rooms>0&&l.floor!==task.floor&&task.floor===2)l.minutes+=rules.minutes.secondFloorAllowance;
    const before=l.minutes;l.minutes+=minutes;l.rooms++;l.floor=task.floor;
    if(before<240&&l.minutes>=240)l.minutes+=rules.minutes.lunch;
  }
  return {assignments:planned,unassigned:ordered.length-planned.length,
    workload:available.map(e=>({id:e.id,name:e.name,...load.get(e.id)!}))};
}
