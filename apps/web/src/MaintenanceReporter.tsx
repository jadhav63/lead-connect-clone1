import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {useLanguage} from './mobile-language';

type Room={id:string;number:string;floor:number};
type Area={id:string;name:string;location:string};
type Places={rooms:Room[];areas:Area[]};
type Ticket={id:string;title:string;description:string;priority:string;status:string;createdAt:string;
  resolution:string|null;room:{number:string}|null;publicArea:{name:string;location:string}|null;assignedTo:{name:string}|null};
const issueTypes=['AC / Heating','Plumbing / Water','Electrical / Lights','TV / Remote','Door / Lock',
  'Furniture / Fixtures','Pest / Odor','Safety Concern','Other'];
export function MaintenanceReporter({reportRequest}:{reportRequest:{number:string;requestId:number}|null}){
  const {t,language}=useLanguage();
  const lastHandled=useRef(0);
  const [places,setPlaces]=useState<Places|null>(null);
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [location,setLocation]=useState(''),[category,setCategory]=useState(issueTypes[0]);
  const [description,setDescription]=useState(''),[priority,setPriority]=useState('MEDIUM');
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  async function refresh(){
    const [p,items]=await Promise.all([api<Places>('/maintenance/report-context'),api<Ticket[]>('/maintenance/my-reports')]);
    if(!Array.isArray(p.rooms)||!Array.isArray(p.areas)||!Array.isArray(items))throw Error('Invalid ticket response');
    setPlaces(p);setTickets(items);setError('');
  }
  useEffect(()=>{let alive=true;void refresh().catch(()=>{if(alive)setError('Could not load maintenance tickets. Try refreshing.');})
    .finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
  useEffect(()=>{
    if(!reportRequest||!places||lastHandled.current===reportRequest.requestId)return;
    const room=places.rooms.find(r=>r.number===reportRequest.number);
    if(room){lastHandled.current=reportRequest.requestId;setLocation('room:'+room.id);setOpen(true);}
  },[reportRequest,places]);
  const locationId=location.slice(location.indexOf(':')+1);
  const sameRoom=places?.rooms.find(r=>r.id===locationId);
  const openForRoom=tickets.filter(ticket=>ticket.status!=='CLOSED'&&sameRoom&&ticket.room?.number===sameRoom.number);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy)return;
    setBusy(true);setMessage('');setError('');
    try{
      if(!places||!location||description.trim().length<5)throw Error('Choose a location and describe the issue.');
      const room=location.startsWith('room:')?places.rooms.find(x=>x.id===locationId):null;
      const area=location.startsWith('area:')?places.areas.find(x=>x.id===locationId):null;
      if((location.startsWith('room:')&&!room)||(location.startsWith('area:')&&!area))throw Error('Location is no longer available.');
      const created=await api<{id:string;status:string}>('/maintenance','POST',{
        title:category,description:location==='general:hotel'?'Other hotel location: '+description.trim():description.trim(),
        priority,...(room?{roomId:room.id}:{}),...(area?{publicAreaId:area.id}:{})
      });
      if(!created.id||created.status!=='OPEN')throw Error('Ticket was not confirmed. Refresh before resubmitting.');
      setMessage('Maintenance request submitted. Supervisors were notified.');
      setDescription('');setOpen(false);
      await refresh();
    }catch(e){setError((e as Error).message||'Ticket not confirmed. Refresh before retrying.');}
    finally{setBusy(false);}
  }
  const stamp=(date:string)=>new Date(date).toLocaleString(language==='es'?'es-US':'en-US');
  return <section className="panel" aria-label={t('Maintenance reports')}>
    <h2>{t('Maintenance reports')}</h2>
    <p>{t('Report a broken item or repair needed. Do not include guest names or personal details.')}</p>
    <div className="actions">
      <button type="button" disabled={busy||loading||!places} onClick={()=>setOpen(v=>!v)}>{t('Report maintenance issue')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>{void refresh().catch(()=>setError('Unable to refresh repair tickets.'));}}>{t('Refresh tickets')}</button>
    </div>
    {loading&&<p role="status">{t('Loading maintenance tickets…')}</p>}
    {open&&places&&<form onSubmit={e=>void submit(e)}>
      <label className="control">{t('Location')}
        <select aria-label={t('Location')} required disabled={busy} value={location} onChange={e=>setLocation(e.target.value)}>
          <option value="">{t('Choose room or area')}</option>
          <optgroup label={t('Guest rooms')}>{places.rooms.map(r=><option value={'room:'+r.id} key={r.id}>{t('Room')} {r.number}</option>)}</optgroup>
          <optgroup label={t('Public areas')}>{places.areas.map(a=><option value={'area:'+a.id} key={a.id}>{a.name} — {a.location}</option>)}</optgroup>
          <option value="general:hotel">{t('Other hotel location (describe below)')}</option>
        </select>
      </label>
      <label className="control">{t('Issue type')}
        <select aria-label={t('Issue type')} disabled={busy} value={category} onChange={e=>setCategory(e.target.value)}>
          {issueTypes.map(item=><option key={item} value={item}>{t(item)}</option>)}
        </select>
      </label>
      <label className="control">{t('What needs repair?')}
        <textarea aria-label={t('What needs repair?')} required minLength={5} maxLength={2000} disabled={busy}
          value={description} placeholder={t('Describe the problem and exact location.')} onChange={e=>setDescription(e.target.value)}/>
      </label>
      <label className="control">{t('Priority')}
        <select aria-label={t('Priority')} value={priority} disabled={busy} onChange={e=>setPriority(e.target.value)}>
          {['LOW','MEDIUM','HIGH','URGENT'].map(item=><option key={item} value={item}>{t(item)}</option>)}
        </select>
      </label>
      {openForRoom.length>0&&<p role="status">{t('An open ticket exists for this room. Review your tickets before reporting a duplicate.')}</p>}
      <p className="muted">{t('For urgent safety hazards, contact your supervisor immediately; this form is not an emergency call.')}</p>
      <div className="actions">
        <button type="submit" disabled={busy}>{busy?t('Submitting…'):t('Submit repair ticket')}</button>
        <button type="button" disabled={busy} className="secondary" onClick={()=>setOpen(false)}>{t('Cancel')}</button>
      </div>
    </form>}
    {message&&<p className="success" role="status">{t(message)}</p>}
    {error&&<p className="error" role="alert">{t(error)}</p>}
    <h3>{t('My reported tickets')} ({tickets.length})</h3>
    {!tickets.length&&!loading&&<p>{t('No repair requests submitted yet.')}</p>}
    {tickets.map(ticket=><article className="work-card" key={ticket.id}>
      <h4>{t(ticket.title)} · {ticket.room?t('Room')+' '+ticket.room.number:
        ticket.publicArea?ticket.publicArea.name:t('General hotel area')}</h4>
      <p>{ticket.description}</p>
      <p>{t('Status')}: <strong>{t(ticket.status==='IN_PROGRESS'?'In progress':ticket.status==='CLOSED'?'Closed':'Open')}</strong>
        {' · '}{t('Priority')}: {t(ticket.priority)}{' · '}{stamp(ticket.createdAt)}</p>
      <p>{t('Assigned to')}: {ticket.assignedTo?.name??t('Not yet assigned')}</p>
      {ticket.resolution&&<p>{t('Repair notes')}: {ticket.resolution}</p>}
    </article>)}
  </section>;
}
