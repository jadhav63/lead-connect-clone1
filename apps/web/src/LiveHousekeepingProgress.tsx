import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './api';
type Staff={id:string;name:string;assigned:number;pending:number;inProgress:number;awaitingInspection:number;verified:number;done:number};
type Recent={id:string;room:string;status:string;at:string};
type Progress={date:string;updatedAt:string;total:number;done:number;pending:number;inProgress:number;
  awaitingInspection:number;verified:number;cancelled:number;unassigned:number;percent:number;
  roomStatusCounts:Record<string,number>;employees:Staff[];recent:Recent[]};
const states=[['pending','Not started'],['inProgress','Cleaning now'],['awaitingInspection','Awaiting inspection'],['verified','Verified']] as const;
const clamp=(x:number)=>Math.max(0,Math.min(100,Number.isFinite(x)?x:0));
function meter(done:number,total:number){
  return total?clamp(Math.round(100*done/total)):0;
}
export function LiveHousekeepingProgress({date}:{date:string}){
  const [value,setValue]=useState<Progress|null>(null),[error,setError]=useState(''),
    [refreshing,setRefreshing]=useState(false),[lastFetch,setLastFetch]=useState<Date|null>(null);
  const sequence=useRef(0);
  const load=useCallback(async()=>{
    const n=++sequence.current;setRefreshing(true);
    try{
      const incoming=await api<Progress>('/housekeeping/live-progress?date='+encodeURIComponent(date));
      if(n!==sequence.current)return;
      if(!Array.isArray(incoming.employees)||!Array.isArray(incoming.recent)||
        !Number.isFinite(incoming.total)||incoming.date!==date)throw Error('Invalid live progress response');
      setValue(incoming);setLastFetch(new Date());setError('');
    }catch(e){if(n===sequence.current)setError((e as Error).message||'Could not refresh dashboard');}
    finally{if(n===sequence.current)setRefreshing(false);}
  },[date]);
  useEffect(()=>{
    setValue(null);setLastFetch(null);setError('');
    void load();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},20000);
    const onVisible=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{++sequence.current;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[load]);
  const total=value?.total??0,done=value?.done??0,percentage=meter(done,total);
  return <section className="panel hk-live" aria-label="Live housekeeping progress">
    <div className="hk-live-heading">
      <div><h2>Housekeeping live progress</h2>
        <p className="muted">Today's assigned room-cleaning tasks · {date} · updates every 20 seconds when visible</p></div>
      <div className="hk-live-refresh"><span className={'hk-live-dot'+(error?' hk-live-dot-stale':'')} aria-hidden="true"/>
        <span>{error?'Update unavailable':refreshing?'Updating…':'Live updates'}</span>
        <button className="secondary" disabled={refreshing} onClick={()=>void load()}>Refresh</button>
      </div>
    </div>
    {error&&<p role="alert">{error}. Showing the most recently confirmed figures, which may be out of date.</p>}
    {!value&&!error&&<p role="status">Loading today's housekeeping progress…</p>}
    {value&&<>
      <div className="hk-live-main">
        <div className="hk-live-percent"><strong>{percentage}%</strong><span>Completed or awaiting inspection</span></div>
        <div className="hk-live-meter-wrap">
          <div className="hk-live-meter" role="progressbar" aria-label="Housekeeping completion"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <div className="hk-live-meter-fill" style={{width:percentage+'%'}}/>
          </div>
          <p>{done} of {total} active cleaning tasks completed · {value.verified} inspected and verified</p>
          {total===0&&<p className="muted">No cleaning assignments are scheduled for this date. 0% is not a performance score.</p>}
        </div>
      </div>
      <div className="hk-live-stats">
        {states.map(([key,label])=><article className={'hk-live-stat hk-'+key} key={key}>
          <span>{label}</span><strong>{value[key]}</strong>
        </article>)}
        <article className="hk-live-stat hk-unassigned"><span>Unassigned</span><strong>{value.unassigned}</strong></article>
      </div>
      <h3>Progress by housekeeper</h3>
      {!value.employees.length&&<p className="muted">No employee assignments recorded for this date.</p>}
      <div className="hk-live-employee-list">{value.employees.map(e=><div className="hk-live-person" key={e.id}>
        <div className="hk-live-person-top"><strong>{e.name}</strong><span>{e.done}/{e.assigned} rooms · {meter(e.done,e.assigned)}%</span></div>
        <div className="hk-live-meter hk-live-meter-small" role="progressbar"
          aria-label={e.name+' completed rooms'} aria-valuenow={meter(e.done,e.assigned)} aria-valuemin={0} aria-valuemax={100}>
          <div className="hk-live-meter-fill" style={{width:meter(e.done,e.assigned)+'%'}}/></div>
        <small>{e.pending} not started · {e.inProgress} cleaning · {e.awaitingInspection} awaiting inspection · {e.verified} verified</small>
      </div>)}</div>
      <details><summary>Recent room completions ({value.recent.length})</summary>
        {value.recent.length?value.recent.map(item=><p key={item.id}>Room {item.room} · {item.status==='VERIFIED'?'Verified':'Awaiting inspection'}
          {' · '}{new Date(item.at).toLocaleTimeString('en-US',{timeZone:'America/Phoenix',hour:'numeric',minute:'2-digit'})}</p>):
          <p>No rooms completed yet today.</p>}
      </details>
      <small>Last successful update: {lastFetch?.toLocaleTimeString('en-US',{timeZone:'America/Phoenix'})??'—'} Arizona time.
        Counts reflect saved tasks, not an estimate or live room occupancy.</small>
    </>}
  </section>;
}
