import { useEffect, useState } from "react";
import { api } from "./api";

type Staff = { id: string; name: string; phone: string | null; email: string | null; department: string | null; jobRole: string | null; employmentStatus: string; appAccessEnabled: boolean };
type StaffInput = { name: string; phone: string | null; email: string | null; department: string | null; jobRole: string | null; employmentStatus: string };
const blank: StaffInput = { name: "", phone: null, email: null, department: null, jobRole: null, employmentStatus: "PENDING_REVIEW" };
const departments = ["Management", "Front Desk", "Housekeeping", "Laundry", "Maintenance", "Breakfast"];
function csvRecords(content: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') { if (quoted && content[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV has an unclosed quoted field");
  if (cell || row.length) { row.push(cell); if (row.some(x => x.trim())) rows.push(row); }
  const head = (rows.shift() ?? []).map(x => x.replace(/^\uFEFF/, "").trim());
  if (!head.length) throw Error("CSV header is missing");
  return rows.map(cells => Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()])));
}
export function HotelStaffDirectory() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<StaffInput>(blank);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  async function refresh() { setRows(await api<Staff[]>("/staff-directory")); }
  useEffect(() => { void refresh().catch(() => setMessage("Directory unavailable until the approved database migration is deployed.")); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setPending(true); setMessage("");
    try {
      const body = { ...form, email: form.email || null, phone: form.phone || null, department: form.department || null, jobRole: form.jobRole || null };
      await api(editing ? "/staff-directory/" + editing : "/staff-directory", editing ? "PATCH" : "POST", body);
      await refresh(); setEditing(null); setForm(blank); setMessage("Saved successfully");
    } catch (e) { setMessage((e as Error).message); } finally { setPending(false); }
  }
  async function importPreview(file: File) {
    setPending(true); setMessage(""); setPreview(null);
    try {
      if (file.size > 100000) throw Error("CSV must be under 100 KB");
      const records = csvRecords(await file.text()).map(r => ({
        name: r.name_as_shown || "", phone: r.phone_us_10_digits || null,
        email: r.email || null, department: null, jobRole: null, employmentStatus: "PENDING_REVIEW"
      }));
      const result = await api<any>("/staff-directory/import-preview", "POST", { propertyCode: "58835", records });
      setPreview(result);
    } catch (e) { setMessage((e as Error).message); } finally { setPending(false); }
  }
  return <section className="panel" aria-label="Staff directory">
    <h2>Staff directory (separate from login accounts)</h2>
    <p className="muted">Contact information can be updated later. Directory profiles do not grant app access; employees must be approved separately.</p>
    <label className="control">Search staff<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Employee name or department" /></label>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Department</th><th>Phone</th><th>Email</th><th>Employment</th><th>App access</th><th>Action</th></tr></thead>
      <tbody>{rows.filter(r => (r.name+" "+(r.department ?? "")).toLowerCase().includes(search.toLowerCase())).map(r =>
      <tr key={r.id}><td>{r.name}</td><td>{r.department || "Unassigned"}</td><td>{r.phone || "—"}</td><td>{r.email || "Add later"}</td><td>{r.employmentStatus}</td><td>{r.appAccessEnabled ? "Enabled" : "Disabled"}</td><td><button type="button" className="secondary" onClick={()=>{setEditing(r.id);setForm({name:r.name,phone:r.phone,email:r.email,department:r.department,jobRole:r.jobRole,employmentStatus:r.employmentStatus});}}>Edit</button></td></tr>)}</tbody></table></div>
    <form onSubmit={save} className="stack">
      <h3>{editing ? "Edit staff profile" : "Add staff profile"}</h3>
      <label className="control">Full name<input required maxLength={200} value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} /></label>
      <label className="control">Phone (10 digits)<input inputMode="tel" value={form.phone ?? ""} pattern="[0-9]{10}" onChange={e=>setForm(x=>({...x,phone:e.target.value||null}))} /></label>
      <label className="control">Email (optional)<input type="email" value={form.email ?? ""} onChange={e=>setForm(x=>({...x,email:e.target.value||null}))} /></label>
      <label className="control">Department<select value={form.department ?? ""} onChange={e=>setForm(x=>({...x,department:e.target.value||null}))}><option value="">Not assigned</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
      <label className="control">Job title<input value={form.jobRole ?? ""} onChange={e=>setForm(x=>({...x,jobRole:e.target.value||null}))} /></label>
      <label className="control">Employment verification<select value={form.employmentStatus} onChange={e=>setForm(x=>({...x,employmentStatus:e.target.value}))}>{["PENDING_REVIEW","ACTIVE","INACTIVE"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
      <div className="actions"><button disabled={pending} type="submit">{editing ? "Save staff changes" : "Add to directory"}</button>{editing && <button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(blank);}}>Cancel</button>}</div>
    </form>
    <details><summary>Preview private staff CSV (no import)</summary><p className="muted">Select your private staff file locally. The manager-only preview checks duplicates and missing emails. No employee accounts or invitations are created.</p>
      <input aria-label="Private staff CSV" type="file" accept=".csv,text/csv" disabled={pending} onChange={async e=>{const file=e.target.files?.[0];if(file) await importPreview(file);e.target.value="";}} />
      {preview && <p role="status">{preview.total} records: {preview.toCreate} to create, {preview.alreadyPresent} existing, {preview.missingEmails} missing emails. No records imported. Production imports require separate approval.</p>}
    </details>
    {message && <p role="status">{message}</p>}
  </section>;
}
export function RoomInventoryPreview() {
  const [result,setResult]=useState<any>(null); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function preview(file:File) {
    setBusy(true); setResult(null);setMessage("");
    try {
      if(file.size>100000)throw Error("CSV must be under 100 KB");
      const rows=csvRecords(await file.text());
      const rooms=rows.map(r=>({
        number:r.room_number,floor:Number(r.floor),roomType:r.room_type,
        ...(r.initial_cleaning_status?{initialStatus:r.initial_cleaning_status}:{}),
        ...(r.initial_occupancy_status?{initialOccupancyStatus:r.initial_occupancy_status}:{})
      }));
      setResult(await api<any>("/room-inventory/preview","POST",{propertyCode:"58835",rooms}));
    }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  return <details className="panel"><summary>Preview Tombstone 60-room inventory (manager only)</summary>
    <p className="muted">Checks exact room types, floors, duplicates and existing records. Preview never imports or changes occupancy.</p>
    <input aria-label="Room inventory CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(file)await preview(file);e.target.value="";}} />
    {result && <p role="status">{result.total} validated rooms; {result.toCreate} new, {result.alreadyPresent} existing, {result.conflicts.length} conflicts, {result.missingInitialStatus.length} missing current status confirmations. No changes made.</p>}
    {message && <p role="alert">{message}</p>}
  </details>;
}
