import { useState } from 'react';
import { api } from './api';

type PdfRoom={number:string;roomType:string;hkStatus:string;occupancyStatus:string;guestStatus:string;
  cleaningType:string|null;pet:boolean;ooo:boolean;ooi:boolean;minutes:number;issues:string[]};
type PdfReview={reportDate:string|null;businessDate:string;rows:PdfRoom[];candidates:number;totalEstimatedMinutes:number;
  registeredRooms:number;rulesVersion:number;fingerprint:string;warnings:string[];canApply:boolean};
type Plan={assignments:{taskId:string;room:string;floor:number;employee:string;minutes:number;service:string}[];
  workload:{name:string;minutes:number;rooms:number}[];rulesVersion:number;fingerprint:string;taskCount:number;
  unassigned:number;canApply:boolean};
function toBase64(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer);let result='';
  for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
}
export function SynxisHousekeepingPanel({date,onApplied}:{date:string;onApplied:()=>void}){
  const [pdfBase64,setPdfBase64]=useState('');
  const [review,setReview]=useState<PdfReview|null>(null);
  const [plan,setPlan]=useState<Plan|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [approve,setApprove]=useState('');
  const [approveAssign,setApproveAssign]=useState('');
  async function run(task:()=>Promise<void>){
    setBusy(true);setError('');setMessage('');
    try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel" aria-label="SynXis PDF and automatic housekeeping">
    <h2>SynXis PDF Import & Auto Assign</h2>
    <p className="muted">Only the manager can approve imports. Preview is read-only. Works with text-based SynXis PDFium Room List reports; scanned or different report formats require review.</p>
    <details open>
      <summary>1. Upload and review SynXis Room List PDF</summary>
      <p>Selected business date: <strong>{date}</strong>. The report footer must match this date, and the 60-room inventory must exist.</p>
      <input type="file" aria-label="SynXis Room List PDF" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{
        const file=e.target.files?.[0];e.target.value='';
        setReview(null);setPdfBase64('');setApprove('');
        if(!file)return;
        void run(async()=>{
          if(file.size>850000)throw Error('PDF must be smaller than 850 KB');
          if(file.type && file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('Select a PDF');
          const encoded=toBase64(await file.arrayBuffer());
          const result=await api<PdfReview>('/housekeeping/synxis/preview','POST',{businessDate:date,pdfBase64:encoded});
          setPdfBase64(encoded);setReview(result);
          setMessage('PDF extracted. Review all rooms before approval.');
        });
      }}/>
      {review&&<>
        <p role="status"><strong>{review.rows.length} rooms parsed</strong> · {review.candidates} cleaning tasks · {review.totalEstimatedMinutes} estimated minutes · Report date: {review.reportDate??'Unknown'}</p>
        {review.warnings.map((w,i)=><p role="alert" key={i}>{w}</p>)}
        <div className="table-wrap"><table><thead><tr><th>Room</th><th>Type</th><th>HK</th><th>Occupancy</th><th>Guest status</th><th>Service</th><th>Min</th><th>Review</th></tr></thead><tbody>
          {review.rows.map((r,i)=><tr key={i}><td>{r.number}</td><td>{r.roomType}</td><td>{r.hkStatus}</td><td>{r.occupancyStatus}</td>
            <td>{r.guestStatus}</td><td>{r.ooo?'OOO':r.ooi?'OOI':r.cleaningType??'None'}{r.pet?' · Pet':''}</td>
            <td>{r.minutes}</td><td>{r.issues.join('; ')||'OK'}</td></tr>)}
        </tbody></table></div>
        {review.canApply?<div className="actions">
          <label className="control">Type APPROVE to import reviewed statuses and create tasks
            <input value={approve} onChange={e=>setApprove(e.target.value)} placeholder="APPROVE" autoComplete="off"/></label>
          <button disabled={busy||approve!=='APPROVE'} onClick={()=>void run(async()=>{
            const response=await api<{roomStatusesUpdated:number;tasksCreated:number}>('/housekeeping/synxis/apply','POST',{
              businessDate:date,pdfBase64,expectedFingerprint:review.fingerprint,confirm:'APPROVE'});
            setMessage('Imported '+response.roomStatusesUpdated+' room statuses and '+response.tasksCreated+' cleaning tasks.');
            setReview(null);setPdfBase64('');setApprove('');onApplied();
          })}>Apply approved PDF import</button></div>:
          <p className="muted">Import disabled until all warnings and room-inventory requirements are resolved. The preview did not change hotel data.</p>}
      </>}
    </details>
    <details open>
      <summary>2. Preview and approve automatic assignments</summary>
      <p className="muted">Uses your saved Settings → Housekeeping Rules and active employees with the Housekeeping app role. Existing assignments are preserved.</p>
      <button className="secondary" disabled={busy} onClick={()=>void run(async()=>{
        setPlan(await api<Plan>('/housekeeping/auto-assign/preview?date='+encodeURIComponent(date)));
        setApproveAssign('');
      })}>Preview auto assignments</button>
      {plan&&<>
        <p role="status">{plan.assignments.length} new assignments · {plan.unassigned} unassigned · {plan.taskCount} open tasks</p>
        <div className="table-wrap"><table><thead><tr><th>Room</th><th>Service</th><th>Employee</th><th>Minutes</th></tr></thead>
          <tbody>{plan.assignments.map(t=><tr key={t.taskId}><td>{t.room}</td><td>{t.service}</td><td>{t.employee}</td><td>{t.minutes}</td></tr>)}</tbody>
        </table></div>
        {plan.workload.length>0&&<p><strong>Staff workload:</strong> {plan.workload.map(s=>s.name+': '+s.rooms+' rooms / '+s.minutes+' min').join(' · ')}</p>}
        {plan.canApply?<div className="actions">
          <label className="control">Type APPROVE to assign these rooms
            <input value={approveAssign} onChange={e=>setApproveAssign(e.target.value)} placeholder="APPROVE" autoComplete="off"/></label>
          <button disabled={busy||approveAssign!=='APPROVE'} onClick={()=>void run(async()=>{
            const response=await api<{assigned:number}>('/housekeeping/auto-assign/apply','POST',{
              date,expectedFingerprint:plan.fingerprint,expectedRulesVersion:plan.rulesVersion,confirm:'APPROVE'});
            setMessage(response.assigned+' rooms assigned and notifications created.');
            setPlan(null);setApproveAssign('');onApplied();
          })}>Apply auto assignments</button></div>:
          <p className="muted">No assignments can be applied. Add active housekeeping employee accounts and unassigned pending tasks first.</p>}
      </>}
    </details>
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
