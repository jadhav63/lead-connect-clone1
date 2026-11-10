import { useEffect, useState } from 'react';
import { api } from './api';

type Rules={
  minutes:{checkout:number;stayover:number;fullService:number;petCheckout:number;deepClean:number;arrivalTouchup:number;cartSetup:number;secondFloorAllowance:number;lunch:number};
  priority:('CHECKOUT'|'STAYOVER'|'ARRIVAL')[];
  startTime:string;fullServiceEveryDays:number;balanceMinutes:boolean;groupFloors:boolean;
  startOnFirstFloor:boolean;lightStayoversToLaundry:boolean;manualOverrideAllowed:boolean;
};
type Saved={version:number;settings:Rules;createdAt:string|null;createdBy:{name:string}|null};
type Version={version:number;createdAt:string;createdBy:{name:string}};
const labels:Record<keyof Rules['minutes'],string>={checkout:'Checkout',stayover:'Stayover',fullService:'Full service',
  petCheckout:'Pet checkout',deepClean:'Deep clean',arrivalTouchup:'Arrival touch-up',cartSetup:'Cart setup',
  secondFloorAllowance:'Second-floor allowance',lunch:'Lunch'};
export function HousekeepingRulesManager(){
  const [saved,setSaved]=useState<Saved|null>(null);
  const [draft,setDraft]=useState<Rules|null>(null);
  const [history,setHistory]=useState<Version[]>([]);
  const [preview,setPreview]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  async function load(){
    const [r,h]=await Promise.all([api<Saved>('/settings/housekeeping-rules'),api<Version[]>('/settings/housekeeping-rules/history')]);
    setSaved(r);setDraft(structuredClone(r.settings));setHistory(h);setPreview(null);
  }
  useEffect(()=>{void load().catch(e=>setNotice((e as Error).message));},[]);
  async function act(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
  function minutes(k:keyof Rules['minutes'],v:string){setDraft(p=>p?{...p,minutes:{...p.minutes,[k]:Number(v)}}:p);}
  function toggle(k:keyof Rules,v:boolean){setDraft(p=>p?{...p,[k]:v}:p);}
  return <section className="panel" aria-label="Housekeeping rules">
    <h2>Housekeeping Rules Manager</h2>
    <p className="muted">Property-specific rules. Changes are versioned and manager-only. This first release previews workload but does not automatically reassign rooms.</p>
    {!draft||!saved?<p>Loading rules… {notice}</p>:<>
      <p><strong>Saved version {saved.version}</strong>{saved.createdBy?' · Last updated by '+saved.createdBy.name:''}</p>
      <div className="table-wrap"><table><thead><tr><th>Task</th><th>Estimated minutes</th></tr></thead><tbody>
        {(Object.keys(labels) as (keyof Rules['minutes'])[]).map(k=><tr key={k}>
          <td>{labels[k]}</td><td><input aria-label={labels[k]+' minutes'} type="number" min={k==='cartSetup'||k==='secondFloorAllowance'||k==='lunch'?0:5} max="240"
          value={draft.minutes[k]} onChange={e=>minutes(k,e.target.value)} /></td></tr>)}
      </tbody></table></div>
      <label className="control">Workday start time<input type="time" value={draft.startTime} onChange={e=>setDraft({...draft,startTime:e.target.value})}/></label>
      <label className="control">Full-service stayover every N days<input type="number" min="1" max="14" value={draft.fullServiceEveryDays}
        onChange={e=>setDraft({...draft,fullServiceEveryDays:Number(e.target.value)})}/></label>
      <label className="control">Assignment priority<select value={draft.priority.join(',')} onChange={e=>setDraft({...draft,priority:e.target.value.split(',') as Rules['priority']})}>
        <option value="CHECKOUT,STAYOVER,ARRIVAL">Checkouts → Stayovers → Arrivals</option>
        <option value="ARRIVAL,CHECKOUT,STAYOVER">Arrivals → Checkouts → Stayovers</option>
        <option value="STAYOVER,CHECKOUT,ARRIVAL">Stayovers → Checkouts → Arrivals</option>
      </select></label>
      {([
        ['balanceMinutes','Balance employee workload by minutes'],
        ['groupFloors','Group assignments by floor'],
        ['startOnFirstFloor','Start with first-floor rooms (100s)'],
        ['lightStayoversToLaundry','Prefer laundry staff for light stayovers'],
        ['manualOverrideAllowed','Allow manager manual assignment overrides']
      ] as const).map(([k,l])=><label className="control" key={k}><input type="checkbox" checked={draft[k]}
        onChange={e=>toggle(k,e.target.checked)}/>{l}</label>)}
      <div className="actions">
        <button disabled={busy} onClick={()=>void act(async()=>{
          const p=await api<any>('/settings/housekeeping-rules/preview','POST',draft);setPreview(p);
          setNotice('Preview generated; no room assignments were changed.');
        })}>Preview current workload</button>
        <button disabled={busy||JSON.stringify(draft)===JSON.stringify(saved.settings)} onClick={()=>void act(async()=>{
          await api('/settings/housekeeping-rules','PUT',{expectedVersion:saved.version,settings:draft});
          await load();setNotice('Rules saved as a new version. Existing assignments were not changed.');
        })}>Save rules</button>
        <button className="secondary" disabled={busy} onClick={()=>{setDraft(structuredClone(saved.settings));setPreview(null);}}>Discard edits</button>
      </div>
      {preview&&<div role="status"><p>{preview.tasks.length} tasks · {preview.totalEstimatedMinutes} estimated cleaning minutes for {preview.businessDate}.</p>
        <p>{preview.notice}</p><div className="table-wrap"><table><thead><tr><th>Room</th><th>Service</th><th>Employee</th><th>Min</th></tr></thead>
        <tbody>{preview.tasks.map((t:any,i:number)=><tr key={i}><td>{t.room}</td><td>{t.cleaningType}</td><td>{t.assignee}</td><td>{t.minutes}</td></tr>)}</tbody></table></div></div>}
      {history.length>0&&<details><summary>Rule history and restore</summary>
        {history.map(h=><div key={h.version} className="actions"><span>Version {h.version} · {h.createdBy.name} · {new Date(h.createdAt).toLocaleString()}</span>
          <button className="secondary" disabled={busy} onClick={()=>void act(async()=>{
            if(!window.confirm('Restore rules from version '+h.version+'? A new version will be recorded.'))return;
            await api('/settings/housekeeping-rules/restore','POST',{version:h.version,expectedVersion:saved.version});
            await load();setNotice('Previous settings restored as a new version.');
          })}>Restore</button></div>)}
      </details>}
      {notice&&<p role="status">{notice}</p>}
    </>}
  </section>;
}
