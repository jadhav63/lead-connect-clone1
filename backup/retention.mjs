export function planRetention(records,{daily=14,weekly=8,monthly=3}={}){
 const valid=records.filter(x=>x.verified===true&&x.status==='success'&&x.id&&x.timestamp).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));const keep=new Set();
 for(const x of valid.slice(0,daily))keep.add(x.id);const weeks=new Set(),months=new Set();
 for(const x of valid){const d=new Date(x.timestamp);const jan1=Date.UTC(d.getUTCFullYear(),0,1),day=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());const wk=`${d.getUTCFullYear()}-${Math.floor((day-jan1)/604800000)}`;if(!weeks.has(wk)&&weeks.size<weekly){weeks.add(wk);keep.add(x.id)}const mo=`${d.getUTCFullYear()}-${d.getUTCMonth()}`;if(!months.has(mo)&&months.size<monthly){months.add(mo);keep.add(x.id)}}
 const newest=valid[0];if(newest)keep.add(newest.id);return{keep:[...keep],deleteCandidates:valid.filter(x=>!keep.has(x.id)).map(x=>x.id),protectedLastVerified:newest?.id??null,remainingVerified:keep.size,dryRun:true};
}
export async function executeRetention(plan,{dryRun=true,approvalReference='',provider}={}){
 if(dryRun)return plan.deleteCandidates.map(id=>({id,action:'would-delete'}));if(!/^JD-APPROVED-[A-Z0-9-]{6,}$/.test(approvalReference))throw Error('Explicit retention approval required');if(plan.remainingVerified<1||!plan.protectedLastVerified)throw Error('No verified recovery point protected');if(!provider||typeof provider.deleteById!=='function')throw Error('Deletion provider unavailable');
 const done=[];for(const id of plan.deleteCandidates){if(id===plan.protectedLastVerified)throw Error('Refusing to delete last verified backup');await provider.deleteById(id);done.push(id)}return done.map(id=>({id,action:'deleted'}));
}
