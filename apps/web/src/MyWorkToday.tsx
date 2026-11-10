import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
import {useLanguage} from './mobile-language';
import {MaintenanceReporter} from './MaintenanceReporter';
type WorkTask={id:string;status:string;startedAt:string|null;completedAt:string|null;verifiedAt:string|null;verifiedBy:{name:string}|null;instructions?:string|null;notes?:string|null;slot?:number;checklist?:string[];completedItems?:string[];room?:{number:string;floor:number};area?:{name:string;location:string;notes:string|null}};
type Work={businessDate:string;property:{name:string;code:string;timezone:string};rooms:WorkTask[];areas:WorkTask[];roomTotals:{completed:number;remaining:number};areaTotals:{completed:number;remaining:number}};
function WorkCard({task,kind,busy,locked,timezone,run,onReport}:{task:WorkTask;kind:'room'|'area';busy:boolean;locked:boolean;timezone:string;run:(task:WorkTask,kind:'room'|'area',body:unknown)=>Promise<void>;onReport:(number:string)=>void}){
  const {t,language}=useLanguage(),[checked,setChecked]=useState(task.completedItems??[]),[notes,setNotes]=useState(task.notes??'');
  const stamp=(v:string|null)=>v?new Date(v).toLocaleString(language==='es'?'es-US':'en-US',{timeZone:timezone}):'—';
  const title=kind==='room'?`${t('Guest rooms')}: ${task.room!.number}`:task.area!.name;
  const state:Record<string,string>={PENDING:'Pending',IN_PROGRESS:'In progress',COMPLETED:'Awaiting inspection',VERIFIED:'Verified',CANCELLED:'Cancelled'};
  return <article className="panel work-card" aria-label={title}><h3>{title}</h3>{task.area&&<p>{task.area.location} · {t('Slot')} {task.slot}</p>}<p className="work-state">{t('Work status')}: {t(state[task.status]??'Unknown')}</p>
    <h4>{t('Instructions')}</h4><p className="preserve-lines">{task.instructions||task.area?.notes||t('No instructions.')}</p>
    {kind==='area'&&<><fieldset disabled={busy||locked||task.status!=='IN_PROGRESS'}><legend>{t('Cleaning checklist')}</legend>{task.checklist?.map(item=><label className="check-item" key={item}><input type="checkbox" checked={checked.includes(item)} onChange={e=>setChecked(x=>e.target.checked?[...x,item]:x.filter(v=>v!==item))}/>{item}</label>)}</fieldset><label className="control">{t('Cleaning notes')}<textarea maxLength={2000} disabled={busy||locked||task.status!=='IN_PROGRESS'} value={notes} onChange={e=>setNotes(e.target.value)}/></label></>}
    <dl><dt>{t('Started')}</dt><dd>{stamp(task.startedAt)}</dd><dt>{t('Finished')}</dt><dd>{stamp(task.completedAt)}</dd><dt>{t('Supervisor inspection')}</dt><dd>{task.verifiedAt?`${t('Verified')} · ${task.verifiedBy?.name??''} · ${stamp(task.verifiedAt)}`:t(task.status==='COMPLETED'?'Awaiting inspection':'Not verified')}</dd></dl>
    <div className="actions">{kind==='room'&&<button type="button" className="secondary work-action" onClick={()=>onReport(task.room!.number)}>{t('Report repair')}</button>}{task.status==='PENDING'&&<button className="work-action" disabled={busy||locked} onClick={()=>void run(task,kind,{status:'IN_PROGRESS'})}>{t('Start')}</button>}{task.status==='IN_PROGRESS'&&<>
      {kind==='area'&&<button className="secondary work-action" disabled={busy||locked} onClick={()=>void run(task,kind,{completedItems:checked,notes})}>{t('Save checklist progress')}</button>}
      <button className="work-action" disabled={busy||locked||(kind==='area'&&checked.length!==task.checklist?.length)} onClick={()=>void run(task,kind,{status:'COMPLETED',...(kind==='area'?{completedItems:checked,notes}:{})})}>{t('Complete')}</button></>}</div>
  </article>;
}
export function MyWorkToday(){
  const {t,language}=useLanguage();const [reportRequest,setReportRequest]=useState<{number:string;requestId:number}|null>(null),[work,setWork]=useState<Work|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[stale,setStale]=useState(false),[message,setMessage]=useState(''),[refreshed,setRefreshed]=useState<Date|null>(null);
  const sequence=useRef(0),mounted=useRef(true),busyRef=useRef(false);
  const load=useCallback(async(explicit=false)=>{
    const n=++sequence.current;
    try{const result=await api<Work>('/my-work');if(!result?.property?.timezone||!Array.isArray(result.rooms)||!Array.isArray(result.areas))throw new Error('Work unavailable');if(mounted.current&&n===sequence.current){setWork(result);setStale(false);setRefreshed(new Date());if(explicit)setUncertain(false);}return true;}
    catch{if(mounted.current&&n===sequence.current)setStale(true);return false;}
    finally{if(mounted.current&&n===sequence.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;void load();const refresh=()=>{if(document.visibilityState==='visible'&&!busyRef.current)void load();};const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);return()=>{mounted.current=false;sequence.current++;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[load]);
  async function run(task:WorkTask,kind:'room'|'area',body:unknown){
    if(busyRef.current||uncertain||stale)return;busyRef.current=true;setBusy(true);setMessage('');
    try{
      const result=await api<WorkTask>((kind==='room'?'/housekeeping/':'/public-area-tasks/')+task.id,'PATCH',body);
      const expected=(body as {status?:string}).status;
      if(result.id!==task.id||(expected&&result.status!==expected)||(expected==='COMPLETED'&&!result.completedAt)||(expected==='IN_PROGRESS'&&!result.startedAt))throw new Error('Unconfirmed response');
      if(!mounted.current)return;
      setWork(old=>old?{...old,[kind==='room'?'rooms':'areas']:(kind==='room'?old.rooms:old.areas).map(item=>item.id===task.id?{...item,...result}:item)}:old);
      setMessage(expected==='COMPLETED'?'Saved — completion confirmed.':expected==='IN_PROGRESS'?'Saved — work started.':'Saved — checklist updated.');
      await load();
    }catch{if(mounted.current){setUncertain(true);setMessage('Change not confirmed. Refresh work before trying again.');}}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  }
  return <section className="my-work" aria-label={t('My Work Today')}><h2>{t('My Work Today')}</h2>{work&&<p>{work.property.name} · {work.businessDate} · {work.property.timezone}</p>}
    <button className="secondary work-action" disabled={busy||loading} onClick={()=>{setMessage('');void load(true);}}>{t('Refresh work')}</button>
    {message&&<p role={uncertain?'alert':'status'} className={uncertain?'error':'success'}>{t(message)}</p>}{stale&&<p role="alert">{t('Could not refresh work. Your previous view may be out of date.')}</p>}
    {loading&&<p role="status">{t('Loading today’s work…')}</p>}{refreshed&&<p>{t('Last refreshed')}: {refreshed.toLocaleTimeString(language==='es'?'es-US':'en-US')}</p>}
    {work&&(['room','area'] as const).map(kind=>{const tasks=kind==='room'?work.rooms:work.areas;const completed=tasks.filter(x=>['COMPLETED','VERIFIED'].includes(x.status)).length;const remaining=tasks.filter(x=>['PENDING','IN_PROGRESS'].includes(x.status)).length;return <section key={kind} aria-label={t(kind==='room'?'Guest rooms':'Public areas')}><h2>{t(kind==='room'?'Guest rooms':'Public areas')}</h2><p className="work-totals">{t('Completed')}: {completed} · {t('Remaining')}: {remaining}</p>{!tasks.length&&<p>{t(kind==='room'?'No guest rooms assigned today.':'No public areas assigned today.')}</p>}{tasks.map(task=><WorkCard key={task.id+task.status} task={task} kind={kind} busy={busy} locked={uncertain||stale} timezone={work.property.timezone} run={run} onReport={number=>setReportRequest(previous=>({number,requestId:(previous?.requestId??0)+1}))}/>)}</section>;})}
    <MaintenanceReporter reportRequest={reportRequest}/>
    <p>{t('Contact your manager to change assignments or request inspection.')}</p>
  </section>;
}
