import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, login, logout, forgetSession } from "./api";
import { parseRoomCSV } from "./csv";
import {
  type Employee,
  type Room,
  type Task,
  roomStatuses,
  occupancyStatuses,
  cleaningTypes,
  label,
  today,
} from "./types";

type Identity = {
  user: { id: string; name: string; email: string };
  propertyId: string;
  roles: string[];
};
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
  value?: string;
  min?: number;
};
const options = (items: string[]) =>
  items.map((value) => ({ value, label: label(value) }));
const employeeOptions = (people: Employee[], role?: string) =>
  people
    .filter((p) => p.membershipActive && (!role || p.role === role))
    .map((p) => ({ value: p.id, label: p.name }));
const roomOptions = (rooms: Room[]) =>
  rooms.map((r) => ({ value: r.id, label: "Room " + r.number }));
function Select({
  name,
  value,
  items,
  onChange,
  disabled = false,
}: {
  name: string;
  value: string;
  items: Option[];
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="control">
      <span>{name}</span>
      <select
        aria-label={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {items.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function RoomCard({
  room,
  editable,
  onSave,
}: {
  room: Room;
  editable: boolean;
  onSave: (data: unknown) => Promise<boolean>;
}) {
  const [status, setStatus] = useState(room.status),
    [occupancy, setOccupancy] = useState(room.occupancyStatus),
    [notes, setNotes] = useState(room.notes ?? ""),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const changed =
    status !== room.status ||
    occupancy !== room.occupancyStatus ||
    notes !== (room.notes ?? "");
  async function save() {
    setSaving(true);
    try {
      if (
        await onSave({
          version: room.version,
          status,
          occupancyStatus: occupancy,
          notes: notes || null,
        })
      )
        setSaved(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <article aria-label={"Room " + room.number} aria-busy={saving} className={"room-card " + room.occupancyStatus.toLowerCase()}>
      <header>
        <div>
          <strong>{room.number}</strong>
          <small>
            {room.roomType ?? "Standard"} · Floor {room.floor}
          </small>
        </div>
        <span className="badge">{label(room.occupancyStatus)}</span>
      </header>
      <p className="room-status">
        <span className={"dot " + room.status.toLowerCase()} />
        {label(room.status)}
      </p>
      {editable && <p className="print-only preserve-lines">{room.notes || "No room notes"}</p>}
      {editable ? (
        <>
          <div className="two">
            <Select
              name={"Room " + room.number + " status"}
              value={status}
              disabled={saving}
              items={options(roomStatuses)}
              onChange={(s) => {
                setStatus(s);
                setSaved(false);
              }}
            />
            <Select
              name={"Room " + room.number + " occupancy"}
              value={occupancy}
              disabled={saving}
              items={options(occupancyStatuses)}
              onChange={(s) => {
                setOccupancy(s);
                setSaved(false);
              }}
            />
          </div>
          <label className="control">
            <span>Room notes</span>
            <textarea
              aria-label={"Room " + room.number + " notes"}
              maxLength={2000}
              disabled={saving}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <button disabled={!changed || saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span role="status" className="inline-success">
              Saved
            </span>
          )}
        </>
      ) : (
        <p className="muted preserve-lines">{room.notes || "No room notes"}</p>
      )}
    </article>
  );
}
function FormPanel({
  title,
  fields,
  submit,
  onSubmit,
  busy,
  open = false,
  children,
}: {
  title: string;
  fields: Field[];
  submit: string;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  open?: boolean;
  children?: ReactNode;
}) {
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = new FormData(form);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const value = String(raw.get(f.name) ?? "");
      if (value !== "" || f.required)
        body[f.name] = f.type === "number" ? Number(value) : value;
    }
    if (await onSubmit(body)) form.reset();
  }
  return (
    <details className="panel form-panel" open={open}>
      <summary>{title}</summary>
      <form onSubmit={send}>
        <div className="form-grid">
          {fields.map((f) => (
            <label className="control" key={f.name}>
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.options ? (
                <select
                  name={f.name}
                  aria-label={f.label}
                  defaultValue={f.value ?? ""}
                  required={f.required}
                >
                  {!f.required && <option value="">Unassigned / none</option>}
                  {f.options.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  aria-label={f.label}
                  required={f.required}
                  maxLength={2000}
                  defaultValue={f.value}
                />
              ) : (
                <input
                  name={f.name}
                  aria-label={f.label}
                  type={f.type ?? "text"}
                  required={f.required}
                  defaultValue={f.value}
                  maxLength={f.type === "password" ? 128 : 2000}
                  minLength={f.type === "password" ? 12 : undefined}
                  min={f.min}
                />
              )}
            </label>
          ))}
        </div>
        {children}
        <button disabled={busy}>{submit}</button>
      </form>
    </details>
  );
}
function AssignmentRow({
  task,
  employees,
  canAssign,
  run,
  busy,
}: {
  task: Task;
  employees: Employee[];
  canAssign: boolean;
  run: (path: string, method: string, body: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const [assigned, setAssigned] = useState(task.assignedToId ?? "");
  const [reworkReason, setReworkReason] = useState("");
  const [saved, setSaved] = useState(false);
  const terminal = ["COMPLETED", "VERIFIED", "CANCELLED"].includes(task.status);
  return (
    <tr>
      <th scope="row">{task.room.number}</th>
      <td>{label(task.cleaningType)}
        <small>Scheduled {task.scheduledFor?.slice(0, 10) ?? "date unavailable"}</small>
        {task.instructions && <small className="preserve-lines">{task.instructions}</small>}
        {task.room.notes && <small className="preserve-lines">Room note: {task.room.notes}</small>}
      </td>
      <td>
        {canAssign && <span className="print-only">{task.assignedTo?.name ?? "Unassigned"}</span>}
        {canAssign ? (
          <div className="assignment screen-only">
            <select
              aria-label={"Assign room " + task.room.number}
              value={assigned}
              disabled={terminal || busy}
              onChange={(e) => {
                setAssigned(e.target.value);
                setSaved(false);
              }}
            >
              <option value="">Unassigned</option>
              {employeeOptions(employees, "HOUSEKEEPING").map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              disabled={
                terminal || busy || assigned === (task.assignedToId ?? "")
              }
              onClick={async () => {
                if (
                  await run("/housekeeping/" + task.id, "PATCH", {
                    assignedToId: assigned || null,
                  })
                )
                  setSaved(true);
              }}
            >
              Save
            </button>
            {saved && <span role="status">Saved</span>}
          </div>
        ) : (
          <span>{task.assignedTo?.name ?? "Unassigned"}</span>
        )}
      </td>
      <td>
        <span className="badge">{label(task.status)}</span>
      </td>
      <td>
        <div className="actions">
          {task.status === "PENDING" && (
            <button
              disabled={busy}
              onClick={() =>
                run("/housekeeping/" + task.id, "PATCH", {
                  status: "IN_PROGRESS",
                })
              }
            >
              Start
            </button>
          )}
          {task.status === "IN_PROGRESS" && (
            <button
              disabled={busy}
              onClick={() =>
                run("/housekeeping/" + task.id, "PATCH", {
                  status: "COMPLETED",
                })
              }
            >
              Complete
            </button>
          )}
          {task.status === "COMPLETED" && canAssign && (
            <button
              disabled={busy}
              onClick={() =>
                run("/housekeeping/" + task.id, "PATCH", { status: "VERIFIED" })
              }
            >
              Verify clean
            </button>
          )}
          {task.status === "COMPLETED" && canAssign && <form className="screen-only" onSubmit={async e => {
            e.preventDefault();
            await run("/housekeeping/" + task.id, "PATCH", { status: "IN_PROGRESS", reworkReason });
          }}>
            <label className="control">Inspection rework for room {task.room.number}<input value={reworkReason} onChange={e => setReworkReason(e.target.value)} required maxLength={1000} /></label>
            <button className="secondary" disabled={busy || !reworkReason.trim()}>Return for cleaning</button>
          </form>}
          {canAssign && ["PENDING", "IN_PROGRESS"].includes(task.status) && (
            <button
              disabled={busy}
              className="secondary"
              onClick={() =>
                run("/housekeeping/" + task.id, "PATCH", {
                  status: "CANCELLED",
                })
              }
            >
              Cancel
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState("Dashboard"),
    [day, setDay] = useState(today()),
    [reportPeriod, setReportPeriod] = useState<"DAY" | "MONTH">("DAY"),
    [reportMonth, setReportMonth] = useState(() => today().slice(0, 7)),
    [data, setData] = useState<any>({}),
    [rooms, setRooms] = useState<Room[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [overdueTasks, setOverdueTasks] = useState<Task[]>([]),
    [property, setProperty] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [search, setSearch] = useState(""),
    [activitySearch, setActivitySearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [csvRows, setCsvRows] = useState<ReturnType<typeof parseRoomCSV> | null>(
      null,
    );
  const manager =
    identity?.roles.some((r) => ["ADMIN", "MANAGER"].includes(r)) ?? false;
  const desk = manager || (identity?.roles.includes("FRONT_DESK") ?? false);
  useEffect(() => {
    api<Identity>("/auth/me")
      .then(setIdentity)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  const loadSequence = useRef(0);
  const activeView = useRef({ identity, page, day, reportPeriod, reportMonth });
  activeView.current = { identity, page, day, reportPeriod, reportMonth };
  async function load() {
    const view = activeView.current;
    if (!identity || view.identity !== identity || view.page !== page || view.day !== day || view.reportPeriod !== reportPeriod || view.reportMonth !== reportMonth) return;
    const sequence = ++loadSequence.current;
    const current = () => sequence === loadSequence.current && activeView.current.identity === identity && activeView.current.page === page && activeView.current.day === day && activeView.current.reportPeriod === reportPeriod && activeView.current.reportMonth === reportMonth;
    setLoading(true);
    setError("");
    try {
      const route: Record<string, string> = {
        Dashboard: "/dashboard?date=" + day,
        Housekeeping: "/housekeeping?date=" + day,
        Maintenance: "/maintenance",
        Notifications: "/notifications",
        Activity: "/audit",
        Reports: reportPeriod === "MONTH" ? "/reports?month=" + reportMonth : "/reports?date=" + day,
      };
      const [rs, ps, people, pageData, overdue] = await Promise.all([
        api<Room[]>("/rooms"),
        api("/properties/current"),
        desk ? api<Employee[]>("/employees") : Promise.resolve([]),
        page === "Front Desk"
          ? Promise.all([api("/front-desk/tasks?date=" + day), api("/front-desk/handovers?date=" + day)])
              .then(([tasks, handovers]) => ({ tasks, handovers }))
          : route[page] ? api(route[page]) : Promise.resolve({}),
        page === "Housekeeping" ? api<Task[]>("/housekeeping/overdue?before=" + day) : Promise.resolve([]),
      ]);
      if (!current()) return;
      setRooms(rs);
      setProperty(ps);
      setEmployees(people);
      setData(pageData);
      setOverdueTasks(overdue);
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setLoading(false);
    }
  }
  useEffect(() => {
    setData({});
    setOverdueTasks([]);
    setError("");
    void load();
    return () => { ++loadSequence.current; };
  }, [identity, page, day, reportPeriod, reportMonth]);
  async function run(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(path, method, body);
      setSuccess("Saved successfully");
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await login(
        String(fields.get("email")),
        String(fields.get("password")),
        String(fields.get("propertyCode")),
      );
      setIdentity(await api<Identity>("/auth/me"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <main className="loading" role="status">
        Connecting to Lead Connect…
      </main>
    );
  if (!identity)
    return (
      <main className="login">
        <div className="login-brand">
          <span className="brand-mark">LC</span>
          <h1>Lead Connect</h1>
          <p>Hotel operations, connected.</p>
          <span className="test-label">{import.meta.env.VITE_APP_ENV === "production" ? "Hotel staff access" : "Separate test project"}</span>
        </div>
        <form onSubmit={signIn} className="login-form">
          <h2>Sign in to your property</h2>
          <p className="muted">Use an account created by your administrator.</p>
          <label className="control">
            Property code
            <input name="propertyCode" autoComplete="organization" required />
          </label>
          <label className="control">
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="control">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {success && <p role="status" className="success">{success}</p>}
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <small>{import.meta.env.VITE_APP_ENV === "production" ? "Authorized hotel employees only." : "No public registration. No live hotel data."}</small>
        </form>
      </main>
    );
  const nav = [
    "Dashboard",
    "Rooms",
    "Housekeeping",
    "Maintenance",
    "Notifications",
    ...(desk ? ["Front Desk", "Employees"] : []),
    ...(manager ? ["Reports", "Activity", "Settings"] : []),
    "Account",
  ];
  const filtered = rooms.filter(
    (r) =>
      (r.number.includes(search) ||
        r.roomType?.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "ALL" || r.occupancyStatus === filter),
  );
  const notifications = Array.isArray(data) ? data : [];
  const activityEntries = Array.isArray(data) ? data : [];
  const visibleActivity = activityEntries.filter((entry: any) => `${entry.actor?.name ?? "System"} ${entry.action ?? "UPDATE"} ${entry.entityType ?? "Record"}`.toLowerCase().includes(activitySearch.toLowerCase()));
  const todayCleaningTasks: Task[] = Array.isArray(data) ? data : [];
  const activeTaskByRoom = new Map(todayCleaningTasks.filter(task => ["PENDING", "IN_PROGRESS"].includes(task.status)).map(task => [task.room.id, task] as const));
  const dirtyCheckoutStayoverRooms = rooms.filter(room => room.status === "DIRTY" && ["DEPARTURE", "OCCUPIED"].includes(room.occupancyStatus));
  return (
    <div className="shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">LC</span>
          <div>
            Lead Connect<small>Hotel operations</small>
          </div>
        </div>
        <span className="test-label">{import.meta.env.VITE_APP_ENV === "production" ? "STAFF OPERATIONS" : "TEST ENVIRONMENT"}</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n}
              className={page === n ? "nav active" : "nav"}
              aria-current={page === n ? "page" : undefined}
              onClick={() => {
                setData({});
                setPage(n);
                setSuccess("");
              }}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="profile">
          <strong>{identity.user.name}</strong>
          <small>{identity.roles.map(label).join(" · ")}</small>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await logout();
              } catch {
                setError("Sign out could not be confirmed. Reconnect and try Sign out again.");
                return;
              }
              setIdentity(null);
              setPage("Dashboard");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace" id="workspace" aria-busy={loading}>
        <header className="topbar">
          <div>
            <small>{property?.name ?? "Your property"}</small>
            <h1>{page}</h1>
          </div>
          <div className="top-actions">
            <label className="control">
              <span>Business date · Arizona</span>
              <input
                type="date"
                aria-label="Business date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              disabled={busy || loading}
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </header>
        <p className="print-only">{property?.name ?? "Your property"} · {page} · {page === "Reports" && reportPeriod === "MONTH" ? reportMonth : day} (Arizona)</p>
        {success && (
          <div role="status" className="success">
            ✓ {success}
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
            <button className="secondary" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {loading && <p role="status" className="loading-message">Loading {page.toLowerCase()}…</p>}
        <div hidden={loading || (!!error && page !== "Account")}>
        {page === "Account" && (
          <form className="panel" onSubmit={async event => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const newPassword = String(fields.get("newPassword"));
            if (newPassword !== String(fields.get("confirmation"))) { setError("The new passwords do not match."); return; }
            setBusy(true);
            try {
              await api("/auth/password", "POST", { currentPassword: String(fields.get("currentPassword")), newPassword });
              forgetSession();
              setIdentity(null);
              setPage("Dashboard");
              setSuccess("Password changed. Sign in with your new password.");
            } catch (e) { setError((e as Error).message); }
            finally { setBusy(false); }
          }}>
            <h2>Change your password</h2>
            <p>Use your own password. Changing it signs out remembered sessions. Other open sessions can remain active for up to 15 minutes.</p>
            <label className="control">Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} /></label>
            <label className="control">New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
            <label className="control">Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
            <button disabled={busy}>{busy ? "Changing password…" : "Change password"}</button>
          </form>
        )}
        {page === "Dashboard" && (
          <>
            <p className="section-intro">Your daily operating picture.</p>
            <div className="stats">
              {[
                ["Rooms", rooms.length],
                [
                  "Departures",
                  rooms.filter((r) => r.occupancyStatus === "DEPARTURE").length,
                ],
                [
                  "Stayovers",
                  rooms.filter((r) => r.occupancyStatus === "OCCUPIED").length,
                ],
                [
                  "Arrivals",
                  rooms.filter((r) => r.occupancyStatus === "ARRIVAL").length,
                ],
                [
                  "Vacant",
                  rooms.filter((r) => r.occupancyStatus === "VACANT").length,
                ],
                ["Open repairs", data.openMaintenance ?? "—"],
              ].map(([name, count]) => (
                <article className="stat" key={name}>
                  <small>{name}</small>
                  <strong>{count}</strong>
                </article>
              ))}
            </div>
            <div className="two">
              <section className="panel">
                <h2>Room readiness</h2>
                {roomStatuses.map((s) => (
                  <div className="metric" key={s}>
                    <span>{label(s)}</span>
                    <strong>
                      {rooms.filter((r) => r.status === s).length}
                    </strong>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Follow-up</h2>
                <div className="metric">
                  Unverified front desk tasks
                  <strong>{data.unverifiedFrontDeskTasks ?? "—"}</strong>
                </div>
                <div className="metric">
                  Unverified handovers
                  <strong>{data.unverifiedHandovers ?? "—"}</strong>
                </div>
                <div className="metric">
                  Overdue open work
                  <strong>{data.overdue?.total ?? "—"}</strong>
                </div>
                {data.overdue && (
                  <p className="muted">
                    {data.overdue.cleaning} cleaning · {data.overdue.frontDesk} front desk · {data.overdue.maintenance} maintenance from earlier business dates
                  </p>
                )}
                <h3>Cleaning today</h3>
                <div className="metric">
                  <span>Progress</span>
                  <strong>
                    {(data.cleaning ?? []).filter((s: any) => ["COMPLETED", "VERIFIED", "CANCELLED"].includes(s.status)).reduce((n: number, s: any) => n + s._count, 0)} / {(data.cleaning ?? []).reduce((n: number, s: any) => n + s._count, 0)} closed
                  </strong>
                </div>
                {(data.cleaning ?? []).map((s: any) => (
                  <div className="metric" key={s.status}>
                    <span>{label(s.status)}</span>
                    <strong>{s._count}</strong>
                  </div>
                ))}
                <p className="muted">Refresh to see the latest changes.</p>
              </section>
            </div>
          </>
        )}
        {page === "Rooms" && (
          <>
            <div className="toolbar">
              <label className="control">
                <span>Search rooms</span>
                <input
                  placeholder="Room number or type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Select
                name="Occupancy filter"
                value={filter}
                items={[
                  { value: "ALL", label: "All rooms" },
                  ...options(occupancyStatuses),
                ]}
                onChange={setFilter}
              />
              <span className="legend">
                <i className="red" />
                Departure <i className="yellow" />
                Stayover <i className="green" />
                Vacant
              </span>
            </div>
            {desk && (
              <FormPanel
                title="Add room"
                fields={[
                  { name: "number", label: "Room number", required: true },
                  {
                    name: "floor",
                    label: "Floor",
                    type: "number",
                    required: true,
                    min: 0,
                  },
                  { name: "roomType", label: "Room type" },
                  { name: "notes", label: "Notes" },
                ]}
                submit="Create room"
                busy={busy}
                onSubmit={(b) => run("/rooms", "POST", b)}
              />
            )}
            <div className="room-grid">
              {filtered.map((room) => (
                <RoomCard
                  key={room.id + "-" + room.version}
                  room={room}
                  editable={desk}
                  onSave={(b) => run("/rooms/" + room.id, "PATCH", b)}
                />
              ))}
            </div>
            {!filtered.length && (
              <Empty>
                No rooms match.{" "}
                {desk ? "Add your fictional test inventory to begin." : ""}
              </Empty>
            )}
          </>
        )}
        {page === "Housekeeping" && (
          <>
            {desk && <section className="panel" aria-labelledby="assignment-queue-title">
              <h2 id="assignment-queue-title">Dirty checkout and stayover queue · {day}</h2>
              {!dirtyCheckoutStayoverRooms.length ? <p>No dirty checkout or stayover rooms are waiting.</p> : <ul className="room-queue">
                {dirtyCheckoutStayoverRooms.map(room => {
                  const task = activeTaskByRoom.get(room.id);
                  const service = room.occupancyStatus === "DEPARTURE" ? "Checkout" : "Stayover";
                  return <li key={room.id}><strong>Room {room.number}</strong><span>{service}</span><span>{task ? `${task.assignedTo?.name ?? "Unassigned"} · ${label(task.status)}` : "Not assigned"}</span></li>;
                })}
              </ul>}
            </section>}
            {desk && (
              <>
                <FormPanel
                  key={day}
                  title="Assign a room"
                  fields={[
                    {
                      name: "roomId",
                      label: "Room",
                      options: roomOptions(rooms),
                      required: true,
                    },
                    {
                      name: "cleaningType",
                      label: "Cleaning type",
                      options: options(cleaningTypes),
                      required: true,
                    },
                    {
                      name: "assignedToId",
                      label: "Employee",
                      options: employeeOptions(employees, "HOUSEKEEPING"),
                    },
                    {
                      name: "scheduledFor",
                      label: "Date",
                      type: "date",
                      value: day,
                      required: true,
                    },
                    { name: "instructions", label: "Instructions" },
                  ]}
                  submit="Save assignment"
                  busy={busy}
                  open
                  onSubmit={(b) => run("/housekeeping", "POST", b)}
                />
                <details className="panel">
                  <summary>Upload daily room CSV</summary>
                  <p>
                    Columns: roomNumber,occupancyStatus,cleaningType. Existing
                    room numbers only. No guest information. Current business
                    date: {day}.
                  </p>
                  <input
                    type="file"
                    aria-label="Daily room CSV"
                    accept=".csv,text/csv"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 100000)
                          throw new Error("CSV must be smaller than 100 KB");
                        setCsvRows(parseRoomCSV(await file.text()));
                      } catch (err) {
                        setError((err as Error).message);
                      }
                      e.target.value = "";
                    }}
                  />
                  {csvRows && (
                    <div className="actions">
                      <p>
                        {csvRows.length} validated room rows ready for {day}.
                      </p>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await run("/housekeeping/import", "POST", {
                              date: day,
                              rows: csvRows,
                            })
                          )
                            setCsvRows(null);
                        }}
                      >
                        Save imported assignments
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setCsvRows(null)}
                      >
                        Discard preview
                      </button>
                    </div>
                  )}
                </details>
              </>
            )}
            <section className="overdue-section" aria-labelledby="overdue-housekeeping-title">
              <h2 id="overdue-housekeeping-title">Overdue cleaning tasks · before {day}</h2>
              <p>These tasks are from earlier business dates and remain pending, in progress, or awaiting verification.</p>
              {!overdueTasks.length ? <p>No overdue cleaning tasks.</p> : <div className="table-wrap"><table>
                <thead><tr>{["Room", "Service and scheduled date", "Employee", "Status", "Action"].map(x => <th key={x}>{x}</th>)}</tr></thead>
                <tbody>{overdueTasks.map(task => <AssignmentRow key={task.id + "-overdue-" + task.status} task={task} employees={employees} canAssign={desk} run={run} busy={busy} />)}</tbody>
              </table></div>}
            </section>}
            <div className="section-heading">
              <h2>Housekeeping board · {day}</h2>
              <button className="secondary" onClick={() => window.print()}>
                Print board
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {["Room", "Service", "Employee", "Status", "Action"].map(
                      (x) => (
                        <th key={x}>{x}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(data) &&
                    data.map((task) => (
                      <AssignmentRow
                        key={
                          task.id + "-" + task.status + "-" + task.assignedToId
                        }
                        task={task}
                        employees={employees}
                        canAssign={desk}
                        run={run}
                        busy={busy}
                      />
                    ))}
                </tbody>
              </table>
            </div>
            {(!Array.isArray(data) || !data.length) && (
              <Empty>No cleaning assignments for this date.</Empty>
            )}
          </>
        )}
        {page === "Maintenance" && (
          <>
            <FormPanel
              title="Create maintenance ticket"
              fields={[
                { name: "title", label: "Issue", required: true },
                {
                  name: "description",
                  label: "Details",
                  type: "textarea",
                  required: true,
                },
                { name: "roomId", label: "Room", options: roomOptions(rooms) },
                {
                  name: "priority",
                  label: "Priority",
                  options: options(["LOW", "MEDIUM", "HIGH", "URGENT"]),
                  required: true,
                  value: "MEDIUM",
                },
                ...(desk
                  ? [
                      {
                        name: "assignedToId",
                        label: "Assign maintenance employee",
                        options: employeeOptions(employees, "MAINTENANCE"),
                      },
                    ]
                  : []),
              ]}
              submit="Create ticket"
              busy={busy}
              onSubmit={(b) => run("/maintenance", "POST", b)}
            />
            <div className="ticket-list">
              {Array.isArray(data) &&
                data.map((t: any) => (
                  <article className="panel" key={t.id}>
                    <div className="section-heading">
                      <h2>{t.title}</h2>
                      <span className={"badge " + t.priority.toLowerCase()}>
                        {t.priority} · {label(t.status)}
                      </span>
                    </div>
                    <p>{t.description}</p>
                    <p className="muted">
                      {t.room ? "Room " + t.room.number : "Public area"} ·{" "}
                      {t.assignedTo?.name ?? "Unassigned"}
                    </p>
                    {desk && (
                      <MaintenanceAssignment
                        ticket={t}
                        employees={employees}
                        run={run}
                        busy={busy}
                      />
                    )}
                    <div className="actions">
                      {t.status === "OPEN" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run("/maintenance/" + t.id, "PATCH", {
                              status: "IN_PROGRESS",
                            })
                          }
                        >
                          Start work
                        </button>
                      )}
                      {t.status === "CLOSED" && desk && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run("/maintenance/" + t.id, "PATCH", {
                              status: "OPEN",
                            })
                          }
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                    {t.status !== "CLOSED" && (
                      <FormPanel
                        title="Complete repair"
                        fields={[
                          {
                            name: "resolution",
                            label: "Completion notes",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        submit="Close ticket"
                        busy={busy}
                        onSubmit={(b) =>
                          run("/maintenance/" + t.id, "PATCH", {
                            ...b,
                            status: "CLOSED",
                          })
                        }
                      />
                    )}
                    <details>
                      <summary>History</summary>
                      {(t.events ?? []).map((event: any) => (
                        <p key={event.id}>
                          {new Date(event.createdAt).toLocaleString()} ·{" "}
                          {event.toStatus ?? "Updated"} · {event.comment ?? ""}
                        </p>
                      ))}
                    </details>
                    {t.resolution && (
                      <p>
                        <strong>Resolution:</strong> {t.resolution}
                      </p>
                    )}
                  </article>
                ))}
            </div>
            {(!Array.isArray(data) || !data.length) && (
              <Empty>No maintenance tickets available.</Empty>
            )}
          </>
        )}
        {page === "Front Desk" && (
          <>
            <FormPanel
              key={day}
              title="Add checklist or inspection"
              fields={[
                { name: "title", label: "Task", required: true },
                {
                  name: "kind",
                  label: "Type",
                  options: options(["CHECKLIST", "INSPECTION", "OTHER"]),
                  required: true,
                },
                {
                  name: "shift",
                  label: "Shift",
                  options: options(["A", "B", "C"]),
                  required: true,
                },
                {
                  name: "scheduledFor",
                  label: "Date",
                  type: "date",
                  value: day,
                  required: true,
                },
                {
                  name: "roomId",
                  label: "Room (required for inspections)",
                  options: roomOptions(rooms),
                },
                {
                  name: "assignedToId",
                  label: "Employee",
                  options: employees
                    .filter((e) =>
                      ["ADMIN", "MANAGER", "FRONT_DESK"].includes(e.role),
                    )
                    .map((e) => ({ value: e.id, label: e.name })),
                },
              ]}
              submit="Add task"
              busy={busy}
              onSubmit={(b) => run("/front-desk/tasks", "POST", b)}
            />
            <section className="panel">
              <h2>Shift tasks</h2>
              {(data.tasks ?? []).map((t: any) => (
                <div className="task-line" key={t.id}>
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.shift} · {label(t.kind)} ·{" "}
                      {t.assignedTo?.name ?? "Unassigned"} · {label(t.status)}
                    </small>
                  </div>
                  <div className="actions">
                    {t.status === "PENDING" && (manager || !t.assignedToId || t.assignedToId === identity.user.id) && <button disabled={busy} onClick={() => run("/front-desk/tasks/" + t.id, "PATCH", { status: "IN_PROGRESS" })}>Start</button>}
                    {["PENDING", "IN_PROGRESS"].includes(t.status) && (manager || !t.assignedToId || t.assignedToId === identity.user.id) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run("/front-desk/tasks/" + t.id, "PATCH", {
                            status: "COMPLETED",
                          })
                        }
                      >
                        Complete
                      </button>
                    )}
                    {manager && t.status === "COMPLETED" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run("/front-desk/tasks/" + t.id, "PATCH", {
                            status: "VERIFIED",
                          })
                        }
                      >
                        Verify
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
            <FormPanel
              key={"handover" + day}
              title="Write shift handover"
              fields={[
                {
                  name: "shift",
                  label: "Outgoing shift",
                  options: options(["A", "B", "C"]),
                  required: true,
                },
                {
                  name: "businessDate",
                  label: "Date",
                  type: "date",
                  value: day,
                  required: true,
                },
                {
                  name: "notes",
                  label: "Handover notes",
                  type: "textarea",
                  required: true,
                },
              ]}
              submit="Save handover"
              busy={busy}
              onSubmit={(b) => run("/front-desk/handovers", "POST", b)}
            />
            {(data.handovers ?? []).map((h: any) => (
              <article className="panel" key={h.id}>
                <h2>
                  Shift {h.shift} · {h.author.name}
                </h2>
                <p className="preserve-lines">{h.notes}</p>
                {h.verifiedAt ? (
                  <p className="inline-success">
                    Incoming shift verified by {h.verifiedBy?.name}
                  </p>
                ) : h.authorId !== identity.user.id ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        "/front-desk/handovers/" + h.id + "/verify",
                        "POST",
                        {},
                      )
                    }
                  >
                    Verify incoming shift
                  </button>
                ) : (
                  <p className="muted">Awaiting incoming shift verification</p>
                )}
              </article>
            ))}
          </>
        )}
        {page === "Employees" && (
          <>
            {manager && (
              <FormPanel
                title="Create employee account"
                fields={[
                  { name: "name", label: "Employee name", required: true },
                  {
                    name: "email",
                    label: "Email",
                    type: "email",
                    required: true,
                  },
                  {
                    name: "password",
                    label: "Temporary password (12+ characters)",
                    type: "password",
                    required: true,
                  },
                  {
                    name: "role",
                    label: "Role",
                    required: true,
                    options: options([
                      "FRONT_DESK",
                      "HOUSEKEEPING",
                      "MAINTENANCE",
                      ...(identity.roles.includes("ADMIN") ? ["MANAGER"] : []),
                    ]),
                  },
                ]}
                submit="Create employee"
                busy={busy}
                onSubmit={(b) => run("/users", "POST", b)}
              />
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.membershipId}>
                      <td>
                        <strong>{e.name}</strong>
                        <small>{e.email}</small>
                      </td>
                      <td>{label(e.role)}</td>
                      <td>{e.membershipActive ? "Active" : "Inactive"}</td>
                      <td>
                        {manager && e.id !== identity.user.id && (
                          <button
                            disabled={busy}
                            className="secondary"
                            onClick={() =>
                              run("/employees/" + e.membershipId, "PATCH", {
                                isActive: !e.membershipActive,
                              })
                            }
                          >
                            {e.membershipActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {page === "Notifications" && (
          <section className="panel">
            <h2>Your notifications</h2>
            {notifications.length === 0 ? (
              <p className="muted">You’re all caught up.</p>
            ) : (
              <div className="stack">
                {notifications.map((item: any) => (
                  <article className="notice" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <small>{label(item.type ?? "GENERAL")} · {new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                    {item.isRead ? <span className="badge">Read</span> : (
                      <button className="secondary" disabled={busy} onClick={() => run(`/notifications/${item.id}/read`, "PATCH", {})}>Mark read</button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {page === "Activity" && manager && (
          <section className="panel">
            <div className="top-actions">
              <h2>Recent property activity</h2>
              <label className="control">
                <span>Filter activity</span>
                <input aria-label="Filter activity" value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} placeholder="Person, action, or record type" />
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
                <tbody>
                  {visibleActivity.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.actor?.name ?? "System"}</td>
                      <td>{label(entry.action ?? "UPDATE")}</td>
                      <td>{label(entry.entityType ?? "Record")}</td>
                    </tr>
                  ))}
                  {!visibleActivity.length && <tr><td colSpan={4}>{activityEntries.length ? "No matching activity." : "No activity recorded yet."}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {page === "Reports" && (
          <>
            <section className="panel">
              <div className="top-actions">
                <div role="group" aria-label="Report period">
                  <button type="button" className="secondary" aria-pressed={reportPeriod === "DAY"} onClick={() => setReportPeriod("DAY")}>Daily report</button>{" "}
                  <button type="button" className="secondary" aria-pressed={reportPeriod === "MONTH"} onClick={() => setReportPeriod("MONTH")}>Monthly report</button>
                </div>
                {reportPeriod === "MONTH" && (
                  <label className="control">
                    <span>Report month</span>
                    <input type="month" aria-label="Report month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
                  </label>
                )}
              </div>
            </section>
            {reportPeriod === "MONTH" ? (
              <>
                <div className="stats">
                  <article className="stat"><small>Scheduled</small><strong>{data.totals?.scheduled ?? 0}</strong></article>
                  <article className="stat"><small>Completed</small><strong>{data.totals?.completed ?? 0}</strong></article>
                  <article className="stat"><small>Verified</small><strong>{data.totals?.verified ?? 0}</strong></article>
                  <article className="stat"><small>Cancelled</small><strong>{data.totals?.cancelled ?? 0}</strong></article>
                  <article className="stat"><small>Estimated completed minutes</small><strong>{data.totals?.estimatedCompletedMinutes ?? 0}</strong></article>
                  <article className="stat"><small>Tracked elapsed minutes</small><strong>{data.totals?.trackedElapsedMinutes ?? 0}</strong></article>
                </div>
                <section className="panel">
                  <h2>Monthly employee cleaning totals · {data.month ?? reportMonth}</h2>
                  <p>Estimates use the default service times. Tracked elapsed time runs from Start to Complete and does not subtract breaks or pauses.</p>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Employee</th><th>Scheduled</th><th>In progress</th><th>Completed</th><th>Verified</th><th>Pending</th><th>Cancelled</th><th>Estimated min</th><th>Elapsed min</th><th>Timed tasks</th></tr></thead>
                      <tbody>
                        {(data.employees ?? []).map((employee: any) => (
                          <tr key={employee.employeeId ?? "unassigned"}>
                            <td>{employee.employeeName}</td><td>{employee.scheduled}</td><td>{employee.inProgress}</td><td>{employee.completed}</td><td>{employee.verified}</td><td>{employee.pending}</td><td>{employee.cancelled}</td><td>{employee.estimatedCompletedMinutes ?? 0}</td><td>{employee.trackedElapsedMinutes ?? 0}</td><td>{employee.timedTaskCount ?? 0}</td>
                          </tr>
                        ))}
                        {!data.employees?.length && <tr><td colSpan={10}>No cleaning assignments for this month.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="stats">
                  <article className="stat"><small>Completed cleanings</small><strong>{data.completed ?? 0}</strong></article>
                  <article className="stat"><small>Verified cleanings</small><strong>{data.verified ?? 0}</strong></article>
                </div>
                <section className="panel">
                  <h2>Cleaning history · {day}</h2>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Room</th><th>Employee</th><th>Service</th><th>Status</th><th>Completed</th></tr></thead>
                      <tbody>
                        {(data.cleaningTasks ?? []).map((t: any) => (
                          <tr key={t.id}>
                            <td>{t.room.number}</td><td>{t.assignedTo?.name ?? "Unassigned"}</td><td>{label(t.cleaningType)}</td><td>{label(t.status)}</td>
                            <td>{t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <Performance tasks={data.cleaningTasks ?? []} />
              </>
            )}
          </>
        )}
        {page === "Settings" && property && (
          <>
            <FormPanel
              key={property.updatedAt}
              title="Update property details"
              fields={[
                {
                  name: "name",
                  label: "Property name",
                  required: true,
                  value: property.name,
                },
                {
                  name: "address",
                  label: "Address",
                  value: property.address ?? "",
                },
              ]}
              submit="Save property"
              busy={busy}
              onSubmit={(b) => run("/properties/current", "PATCH", b)}
            />
            <section className="panel">
              <h2>Environment</h2>
              <p>
                This is an isolated test application. No production hotel data
                is authorized.
              </p>
              <div className="metric">
                Property code<strong>{property.code}</strong>
              </div>
              <div className="metric">
                Business timezone<strong>{property.timezone}</strong>
              </div>
              <p className="muted">
                Connection strings and signing secrets are configured only on
                the server.
              </p>
            </section>
          </>
        )}
        </div>
        <footer className="workspace-footer">
          {import.meta.env.VITE_APP_ENV === "production" ? "Lead Connect · Hotel staff operations · Manual PMS reconciliation" : "Lead Connect · Separate hotel operations test project · No PMS connection"}
        </footer>
      </main>
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
function MaintenanceAssignment({
  ticket,
  employees,
  run,
  busy,
}: {
  ticket: any;
  employees: Employee[];
  run: (p: string, m: string, b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const [value, setValue] = useState(ticket.assignedToId ?? "");
  return (
    <div className="assignment">
      <Select
        name="Assigned technician"
        value={value}
        items={[
          { value: "", label: "Unassigned" },
          ...employeeOptions(employees, "MAINTENANCE"),
        ]}
        onChange={setValue}
      />
      <button
        className="secondary"
        disabled={busy || value === (ticket.assignedToId ?? "")}
        onClick={() =>
          run("/maintenance/" + ticket.id, "PATCH", {
            assignedToId: value || null,
          })
        }
      >
        Save assignment
      </button>
    </div>
  );
}
function Performance({ tasks }: { tasks: any[] }) {
  const totals = new Map<
    string,
    { name: string; completed: number; verified: number }
  >();
  for (const t of tasks) {
    if (!t.assignedTo) continue;
    const row = totals.get(t.assignedTo.id) ?? {
      name: t.assignedTo.name,
      completed: 0,
      verified: 0,
    };
    if (["COMPLETED", "VERIFIED"].includes(t.status)) row.completed++;
    if (t.status === "VERIFIED") row.verified++;
    totals.set(t.assignedTo.id, row);
  }
  return (
    <section className="panel">
      <h2>Employee cleaning totals</h2>
      {[...totals.values()].map((t) => (
        <div className="metric" key={t.name}>
          <span>{t.name}</span>
          <span>
            {t.completed} completed · {t.verified} verified
          </span>
        </div>
      ))}
    </section>
  );
}
