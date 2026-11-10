import {Router} from 'express';
import {prisma} from '../lib/db.js';
import {requireAuth,requireRole} from '../middleware/auth.js';
const router=Router();
router.get('/my-work',requireAuth,requireRole('HOUSEKEEPING','ADMIN','MANAGER'),async(req,res)=>{
  const {propertyId,userId}=req.auth!;
  const property=await prisma.property.findUniqueOrThrow({where:{id:propertyId},select:{name:true,code:true,timezone:true}});
  const businessDate=new Intl.DateTimeFormat('en-CA',{timeZone:property.timezone}).format(new Date());
  const day=new Date(`${businessDate}T00:00:00.000Z`);
  const [rooms,areas]=await prisma.$transaction([
    prisma.cleaningTask.findMany({where:{propertyId,assignedToId:userId,scheduledFor:day},include:{room:{select:{number:true,floor:true,roomType:true,status:true}},verifiedBy:{select:{name:true}}},orderBy:{room:{number:'asc'}}}),
    prisma.publicAreaTask.findMany({where:{propertyId,assignedToId:userId,scheduledFor:day},include:{area:{select:{name:true,location:true,notes:true}},verifiedBy:{select:{name:true}}},orderBy:[{area:{sortOrder:'asc'}},{slot:'asc'}]})
  ]);
  const totals=(tasks:Array<{status:string}>)=>({completed:tasks.filter(t=>['COMPLETED','VERIFIED'].includes(t.status)).length,remaining:tasks.filter(t=>['PENDING','IN_PROGRESS'].includes(t.status)).length,awaitingInspection:tasks.filter(t=>t.status==='COMPLETED').length,verified:tasks.filter(t=>t.status==='VERIFIED').length});
  res.json({businessDate,property,rooms,areas,roomTotals:totals(rooms),areaTotals:totals(areas)});
});
export default router;
