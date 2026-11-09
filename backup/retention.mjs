export function planRetention(records,{now=new Date(),daily=14,weekly=8,monthly=3}={}){
 const valid=records.filter(x=>x.verified===true&&x.status==='success'&&x.id&&x.timestamp).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
 const keep=new Set();for(const x of valid.slice(0,daily))keep.add(x.id);
 const week=new Set(),month=new Set();for(const x of valid){const d=new Date(x.timestamp);const wk=`${d.getUTCFullYear()}-${Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(d.getUTCFullYear(),0,1))/604800000)}`;if(!week.has(wk)&&week.size<weekly){week.add(wk);keep.add(x.id)}const mo=`${d.getUTCFullYear()}-${d.getUTCMonth()}`;if(!month.has(mo)&&month.size<monthly){month.add(mo);keep.add(x.id)}}
 const last=valid[0];if(last)keep.add(last.id);return {keep:[...keep],deleteCandidates:records.filter(x=>x.verified&&x.status==='success'&&!keep.has(x.id)).map(x=>x.id),protectedLastVerified:last?.id??null,dryRun:true};
}
export function applyRetentionPlan(plan,{dryRun=true,deleteById=()=>{}}={}){if(!dryRun)throw Error('Actual deletion is disabled pending explicit activation approval');return plan.deleteCandidates.map(id=>({id,action:'would-delete'}));}
