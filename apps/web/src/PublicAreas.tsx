import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';

export const areaExamples=['Lobby / Front Desk','Breakfast Room','Ground Floor Laundry Room','Second Floor Laundry Room','Ground Floor Hallways','Second Floor Hallways','Stairways','Public Restrooms','Pool & Hot Tub Area','Fire Pit / BBQ Area','Parking Lot & Entrances','Business Center'];
const departments=['Management','Front Desk','Housekeeping','Laundry','Maintenance','Breakfast'];
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
type Person={id:string;name:string};
type Area={id:string;name:string;location:string;department:string;frequency:string;weeklyDay:number;isActive:boolean;sortOrder:number;notes:string|null;checklist:string[];assignedToId:string|null;assignedStaffId:string|null};
type Task={id:string;area:{id:string;name:string;location:string;isActive:boolean};slot:number;status:string;scheduledFor:string;checklist:string[];completedItems:string[];assignedToId:string|null;assignedStaffId:string|null;assignedTo?:Person|null;assignedStaff?:Person|null;startedAt:string|null;completedAt:string|null;verifiedAt:string|null;verifiedBy?:Person|null;completedById:string|null;notes:string|null};
type Options={users:Person[];staff:Person[]};
const empty={name:'',location:'',department:'Housekeeping',frequency:'DAILY',weeklyDay:1,isActive:true,notes:'',checklist:'',assignment:''};
const stamp=(value:string|null)=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Phoenix'}):'—';
const assignment=(userId:string|null,staffId:string|null)=>userId?'user:'+userId:staffId?'staff:'+staffId:'';
function assigneeBody(value:string){return {assignedToId:value.startsWith('user:')?value.slice(5):null,assignedStaffId:value.startsWith('staff:')?value.slice(6):null};}
function EmployeeSelect({value,onChange,options,label,disabled=false}:{value:string;onChange:(v:string)=>void;options:Options;label:string;disabled?:boolean}){
  return <label className="control">{label}<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Unassigned</option><optgroup label="Login employees">{options.users.map(p=><option key={p.id} value={'user:'+p.id}>{p.name}</option>)}</optgroup><optgroup label="Directory profiles (no login)">{options.staff.map(p=><option key={p.id} value={'staff:'+p.id}>{p.name} · directory only</option>)}</optgroup></select></label>;
}
export function PublicAreaReport({day}:{day:string}){
  const [report,setReport]=useState<any>(null),[error,setError]=useState('');
  useEffect(()=>{let current=true;setReport(null);setError('');api('/public-area-reports?date='+day).then(r=>{if(!r || !['tasks','productivity','missedTasks','maintenanceIssues'].every(k=>Array.isArray(r[k])))throw new Error('Public-area report is unavailable. Reload to retry.');if(current)setReport(r);}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[day]);
  if(error)return <section className="panel"><h2>Public-area cleaning report</h2><p role="alert">{error}</p></section>;
  if(!report)return <p role="status">Loading public-area report…</p>;
  const names=new Map<string,string>(report.tasks.map((t:Task)=>[t.assignedToId??t.assignedStaffId??'unassigned',t.assignedTo?.name??t.assignedStaff?.name??'Unassigned']));
  return <section className="panel" aria-label="Public-area cleaning report"><h2>Public-area cleaning · {day}</h2><p>Separate from guest-room cleaning and occupancy. Missed tasks are earlier assignments still pending or in progress.</p>
    <div className="metrics">{['assigned','completed','pending','verified','cancelled','missed','awaitingVerification'].map(key=><div className="metric" key={key}>{key.replace(/([A-Z])/g,' $1')}<strong>{report[key]}</strong></div>)}</div>
    <h3>Employee productivity</h3><div className="table-wrap"><table><thead><tr>{['Employee','Assigned','Completed','Verified','Cleaning minutes'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{report.productivity.map((p:any)=><tr key={p.employeeId}><td>{names.get(p.employeeId)??'Unassigned'}</td><td>{p.assigned}</td><td>{p.completed}</td><td>{p.verified}</td><td>{p.minutes.toFixed(1)}</td></tr>)}</tbody></table></div>
    <h3>Daily assignments and timestamps</h3><TaskHistory tasks={report.tasks}/>
    <h3>Missed assignments</h3><TaskHistory tasks={report.missedTasks}/>
    <h3>Related maintenance issues</h3>{!report.maintenanceIssues.length?<p>No public-area maintenance issues.</p>:<ul>{report.maintenanceIssues.map((t:any)=><li key={t.id}>{t.publicArea.name}: {t.title} · {t.status} · {t.priority}</li>)}</ul>}
  </section>;
}
function TaskHistory({tasks}:{tasks:Task[]}){return !tasks.length?<p>No assignments in this view.</p>:<div className="table-wrap"><table><thead><tr>{['Area / date','Employee','Status','Started','Completed','Verified by / time','Notes'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.area.name} · {t.scheduledFor.slice(0,10)} · slot {t.slot}</td><td>{t.assignedTo?.name??t.assignedStaff?.name??'Unassigned'}</td><td>{t.status}</td><td>{stamp(t.startedAt)}</td><td>{stamp(t.completedAt)}</td><td>{t.verifiedBy?.name??'—'} · {stamp(t.verifiedAt)}</td><td>{t.notes??'—'}</td></tr>)}</tbody></table></div>;}
function TaskCard({task:t,manager,userId,options,busy,run}:{task:Task;manager:boolean;userId:string;options:Options;busy:boolean;run:(path:string,method:string,body:unknown)=>Promise<void>}){
  const [checked,setChecked]=useState(t.completedItems),[notes,setNotes]=useState(t.notes??''),[selected,setSelected]=useState(assignment(t.assignedToId,t.assignedStaffId));
  const path='/public-area-tasks/'+t.id;
  const canWork=manager||t.assignedToId===userId;
  return <article className="panel" aria-label={t.area.name+' task '+t.slot}><h3>{t.area.name} · slot {t.slot}</h3><p>{t.area.location} · {t.status} · {t.assignedTo?.name??t.assignedStaff?.name??'Unassigned'}</p>
    {manager&&['PENDING','IN_PROGRESS'].includes(t.status)&&<><EmployeeSelect label={'Assign '+t.area.name+' slot '+t.slot} value={selected} onChange={setSelected} options={options} disabled={busy}/><button disabled={busy||selected===assignment(t.assignedToId,t.assignedStaffId)} onClick={()=>void run(path,'PATCH',assigneeBody(selected))}>Save assignment</button></>}
    <fieldset disabled={busy||!canWork||t.status!=='IN_PROGRESS'}><legend>Cleaning checklist</legend>{!t.checklist.length&&<p>No checklist specified.</p>}{t.checklist.map(item=><label className="control" key={item}><input type="checkbox" checked={checked.includes(item)} onChange={e=>setChecked(x=>e.target.checked?[...x,item]:x.filter(v=>v!==item))}/>{item}</label>)}</fieldset>
    <label className="control">Cleaning notes<textarea value={notes} disabled={busy||!canWork||['VERIFIED','CANCELLED','COMPLETED'].includes(t.status)} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
    <div className="actions">{canWork&&t.status==='PENDING'&&<button disabled={busy} onClick={()=>void run(path,'PATCH',{status:'IN_PROGRESS'})}>Start cleaning</button>}
    {canWork&&t.status==='IN_PROGRESS'&&<button disabled={busy||checked.length!==t.checklist.length} onClick={()=>void run(path,'PATCH',{status:'COMPLETED',completedItems:checked,notes})}>Complete cleaning</button>}
    {manager&&t.status==='COMPLETED'&&<><button disabled={busy||t.completedById===userId} onClick={()=>void run(path,'PATCH',{status:'VERIFIED'})}>Verify area cleaning</button><button disabled={busy} onClick={()=>void run(path,'PATCH',{status:'IN_PROGRESS'})}>Return for cleaning</button>{t.completedById===userId&&<p>A different supervisor must verify your cleaning.</p>}</>}
    {manager&&['PENDING','IN_PROGRESS'].includes(t.status)&&<button className="secondary" disabled={busy} onClick={()=>void run(path,'PATCH',{status:'CANCELLED'})}>Cancel task</button>}</div>
    <p>Started {stamp(t.startedAt)} · Completed {stamp(t.completedAt)} · Verified {stamp(t.verifiedAt)}</p>
  </article>;
}
export function PublicAreas({day,manager,userId}:{day:string;manager:boolean;userId:string}){
  const [areas,setAreas]=useState<Area[]>([]),[tasks,setTasks]=useState<Task[]>([]),[options,setOptions]=useState<Options>({users:[],staff:[]});
  const [form,setForm]=useState(empty),[editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [history,setHistory]=useState<Task[]|null>(null),[historyName,setHistoryName]=useState(''),[report,setReport]=useState(false),[revision,setRevision]=useState(0);
  const [through,setThrough]=useState(day);
  const sequence=useRef(0);
  const load=useCallback(async()=>{
    const seq=++sequence.current;setLoading(true);
    try{const [a,t,o]=await Promise.all([api<Area[]>('/public-areas'),api<Task[]>('/public-area-tasks?date='+day),api<Options>('/public-areas/assignees')]);if(seq===sequence.current){setAreas(a);setTasks(t);setOptions(o);}}
    catch(e){if(seq===sequence.current)setError((e as Error).message);}finally{if(seq===sequence.current)setLoading(false);}
  },[day]);
  useEffect(()=>{setError('');setHistory(null);setThrough(day);void load();return()=>{sequence.current++;};},[load,day]);
  async function run(path:string,method:string,body:unknown){setBusy(true);setError('');setMessage('');try{await api(path,method,body);await load();setHistory(null);setRevision(x=>x+1);setMessage('Saved successfully');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{const {assignment:selected,checklist,...rest}=form;await api(editing?'/public-areas/'+editing:'/public-areas',editing?'PATCH':'POST',{...rest,...assigneeBody(selected),checklist:checklist.split('\n').map(x=>x.trim()).filter(Boolean)});setForm(empty);setEditing(null);await load();setMessage('Saved successfully');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function edit(a:Area){setEditing(a.id);setForm({name:a.name,location:a.location,department:a.department,frequency:a.frequency,weeklyDay:a.weeklyDay,isActive:a.isActive,notes:a.notes??'',checklist:a.checklist.join('\n'),assignment:assignment(a.assignedToId,a.assignedStaffId)});}
  async function move(index:number,delta:number){const ids=areas.map(a=>a.id);[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];await run('/public-areas/reorder','POST',{ids});}
  return <section aria-label="Public-area workspace"><p>Public areas are separate from guest rooms. No example areas are created automatically.</p>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
    <div className="actions"><button disabled={busy||loading} onClick={()=>void load()}>Reload public areas</button>{manager&&<><button disabled={busy||loading} onClick={()=>void run('/public-area-tasks/prepare','POST',{from:day,to:day})}>Prepare daily assignments</button><button onClick={()=>setReport(x=>!x)}>{report?'Hide':'Show'} public-area report</button></>}</div>
    {manager&&<div className="toolbar"><label className="control">Schedule through<input type="date" min={day} value={through} onChange={e=>setThrough(e.target.value)}/></label><button disabled={busy||loading||!through} onClick={()=>void run('/public-area-tasks/prepare','POST',{from:day,to:through})}>Prepare recurring date range</button><p>Prepare up to 31 days. Existing assignments are kept; repeats do not duplicate them.</p></div>}
    {loading?<p role="status">Loading area assignments…</p>:<><h2>Daily area status · {day}</h2>{!tasks.length&&<p>No assignments. A manager can prepare recurring tasks for this date or add an on-demand task.</p>}{tasks.map(t=><TaskCard key={t.id+':'+t.status+':'+t.assignedToId+':'+t.assignedStaffId} task={t} manager={manager} userId={userId} options={options} busy={busy} run={run}/>)}
    <h2>{manager?'Manage public areas':'Public areas'}</h2>{!areas.length&&<p>No public areas configured.</p>}{areas.map((a,i)=><article className="panel" key={a.id}><h3>{a.name}</h3><p>{a.location} · {a.department} · {a.frequency.replaceAll('_',' ')}{a.frequency==='WEEKLY'?' · '+weekdays[a.weeklyDay]:''} · {a.isActive?'Active':'Inactive'}</p><p>{a.notes}</p><ul>{a.checklist.map(x=><li key={x}>{x}</li>)}</ul>
      <div className="actions">{manager&&<><button disabled={busy} onClick={()=>edit(a)}>Edit {a.name}</button><button disabled={busy||i===0} onClick={()=>void move(i,-1)} aria-label={'Move '+a.name+' up'}>Move up</button><button disabled={busy||i===areas.length-1} onClick={()=>void move(i,1)} aria-label={'Move '+a.name+' down'}>Move down</button><button disabled={busy} onClick={()=>void run('/public-areas/'+a.id,'PATCH',{isActive:!a.isActive})}>{a.isActive?'Deactivate':'Activate'} {a.name}</button>{a.isActive&&<button disabled={busy} onClick={()=>void run('/public-areas/'+a.id+'/tasks','POST',{date:day,slot:1})}>Add task for {a.name}</button>}</>}
      <button disabled={busy} onClick={async()=>{try{setHistory(await api('/public-areas/'+a.id+'/history'));setHistoryName(a.name);}catch(e){setError((e as Error).message);}}}>History for {a.name}</button></div>
      {a.isActive&&<details><summary>Report maintenance for {a.name}</summary><form className="stack" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run('/public-areas/'+a.id+'/maintenance','POST',{title:f.get('title'),description:f.get('description'),priority:f.get('priority')});}}><label className="control">Issue<input name="title" required minLength={2} maxLength={200}/></label><label className="control">Details<textarea name="description" required minLength={2} maxLength={2000}/></label><label className="control">Priority<select name="priority" defaultValue="MEDIUM">{['LOW','MEDIUM','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label><button disabled={busy}>Create linked maintenance request</button></form></details>}
    </article>)}</>}
    {history&&<section className="panel"><h2>Cleaning history · {historyName}</h2><p>Most recent 100 assignments.</p><TaskHistory tasks={history}/></section>}
    {manager&&<form className="panel stack" onSubmit={save}><h2>{editing?'Edit public area':'Add public area'}</h2><fieldset disabled={busy}><legend>Area details</legend>
      {!editing&&<label className="control">Optional area example<select value="" onChange={e=>setForm(x=>({...x,name:e.target.value}))}><option value="">Choose an example or enter your own</option>{areaExamples.map(x=><option key={x}>{x}</option>)}</select></label>}
      <label className="control">Area name<input required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label>
      <label className="control">Floor or location<input required maxLength={120} value={form.location} onChange={e=>setForm(x=>({...x,location:e.target.value}))}/></label>
      <label className="control">Department responsible<select value={form.department} onChange={e=>setForm(x=>({...x,department:e.target.value}))}>{departments.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="control">Cleaning frequency<select value={form.frequency} onChange={e=>setForm(x=>({...x,frequency:e.target.value}))}>{['ON_DEMAND','DAILY','TWICE_DAILY','WEEKLY'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
      {form.frequency==='WEEKLY'&&<label className="control">Day of week<select value={form.weeklyDay} onChange={e=>setForm(x=>({...x,weeklyDay:Number(e.target.value)}))}>{weekdays.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></label>}
      <label className="control">Notes<textarea maxLength={2000} value={form.notes} onChange={e=>setForm(x=>({...x,notes:e.target.value}))}/></label>
      <label className="control">Checklist (one item per line)<textarea value={form.checklist} onChange={e=>setForm(x=>({...x,checklist:e.target.value}))}/></label>
      <EmployeeSelect label="Default assigned employee" value={form.assignment} onChange={assignment=>setForm(x=>({...x,assignment}))} options={options}/><p>Directory assignment never creates a login. A manager records work for staff without app access.</p>
      <label className="control"><input type="checkbox" checked={form.isActive} onChange={e=>setForm(x=>({...x,isActive:e.target.checked}))}/>Active area</label>
    </fieldset><div className="actions"><button disabled={busy}>{editing?'Save area changes':'Create public area'}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel edit</button>}</div></form>}
    {manager&&report&&<PublicAreaReport key={revision} day={day}/>}
  </section>;
}
