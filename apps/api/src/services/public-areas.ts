import { z } from 'zod';
import { HttpError } from '../lib/errors.js';

export const areaInput = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().min(1).max(120),
  department: z.enum(['Management', 'Front Desk', 'Housekeeping', 'Laundry', 'Maintenance', 'Breakfast']),
  frequency: z.enum(['ON_DEMAND','DAILY','TWICE_DAILY','WEEKLY']),
  // Creation defaults live in Prisma; PATCH must never default an omitted field.
  weeklyDay: z.number().int().min(0).max(6).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  checklist: z.array(z.string().trim().min(1).max(200)).max(40).refine(x=>new Set(x).size===x.length,'Checklist items must be unique'),
  assignedToId: z.uuid().nullable().optional(),
  assignedStaffId: z.uuid().nullable().optional(),
}).strict();

export function assertSingleAssignee(value: {assignedToId?: string | null; assignedStaffId?: string | null}) {
  if (value.assignedToId && value.assignedStaffId) throw new HttpError(400,'Choose a login employee or a directory profile, not both');
}
export function recurrenceSlots(frequency: string, weeklyDay: number, day: Date) {
  return frequency === 'ON_DEMAND' ? [] : frequency === 'WEEKLY' && day.getUTCDay() !== weeklyDay ? [] : frequency === 'TWICE_DAILY' ? [1,2] : [1];
}
export function assertAreaTransition(current: string, next: string, supervisor: boolean, assigned: boolean, checklist: string[], checked: string[]) {
  if (!supervisor && !assigned) throw new HttpError(403,'Only the assigned login employee or a supervisor may update this task');
  const allowed: Record<string,string[]> = {PENDING:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],COMPLETED:['VERIFIED','IN_PROGRESS'],VERIFIED:[],CANCELLED:[]};
  if (!allowed[current]?.includes(next)) throw new HttpError(409,'Task changed or transition is not allowed');
  if (['VERIFIED','CANCELLED'].includes(next) || current==='COMPLETED') {
    if (!supervisor) throw new HttpError(403,'Supervisor approval required');
  }
  if (next==='COMPLETED' && (checked.length!==checklist.length || checked.some(x=>!checklist.includes(x)) || new Set(checked).size!==checked.length)) throw new HttpError(400,'Complete every checklist item before finishing');
}

export function areaReport(tasks: Array<{status:string; scheduledFor:Date; assignedToId:string|null; assignedStaffId:string|null; startedAt:Date|null; completedAt:Date|null; verifiedAt:Date|null}>, day: Date) {
  const today=tasks.filter(t=>t.scheduledFor.getTime()===day.getTime());
  const productivity: Record<string,{employeeId:string;assigned:number;completed:number;verified:number;minutes:number}>={};
  for(const t of today) {
    const id=t.assignedToId ?? t.assignedStaffId ?? 'unassigned';
    const p=productivity[id] ??= {employeeId:id,assigned:0,completed:0,verified:0,minutes:0};
    p.assigned++; if(['COMPLETED','VERIFIED'].includes(t.status))p.completed++; if(t.status==='VERIFIED')p.verified++;
    if(t.startedAt && t.completedAt)p.minutes+=Math.max(0,(t.completedAt.getTime()-t.startedAt.getTime())/60000);
  }
  return {assigned:today.length,completed:today.filter(t=>['COMPLETED','VERIFIED'].includes(t.status)).length,pending:today.filter(t=>['PENDING','IN_PROGRESS'].includes(t.status)).length,verified:today.filter(t=>t.status==='VERIFIED').length,cancelled:today.filter(t=>t.status==='CANCELLED').length,missed:tasks.filter(t=>t.scheduledFor<day && ['PENDING','IN_PROGRESS'].includes(t.status)).length,awaitingVerification:tasks.filter(t=>t.scheduledFor<=day && t.status==='COMPLETED').length,productivity:Object.values(productivity)};
}
