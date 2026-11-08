Warning: truncated output (original token count: 13254)
Total output lines: 1487

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, login, logout } from "./api";
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
  children,
}: {
  title: string;
  fields: Field[];
  submit: string;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
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
    <details className="panel form-panel">
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
                  required={f.required}
                  maxLength={2000}
                  defaultValue={f.value}
                />
              ) : (
                <input
                  name={f.name}
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
  const [saved, setSaved] = useState(false);
  const terminal = ["COMPLETED", "VERIFIED", "CANCELLED"].includes(task.status);
  return (
    <tr>
      <th scope="row">{task.room.number}</th>
      <td>{label(task.cleaningType)}</td>
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
      const [rs, ps, people, pageData] = await Promise.all([
        api<Room[]>("/rooms"),
        api("/properties/current"),
        desk ? api<Employee[]>("/employees") : Promise.resolve([]),
        page === "Front Desk"
          ? Promise.all([api("/front-desk/tasks?date=" + day), api("/front-desk/handovers?date=" + day)])
              .then(([tasks, handovers]) => ({ tasks, handovers }))
          : route[page] ? api(route[page]) : Promise.resolve({}),
      ]);
      if (!current()) return;
      setRooms(rs);
      setProperty(ps);
      setEmployees(people);
      setData(pageData);
    } catch (e) {
      if (current()) setError((e as Error).message);
    } finally {
      if (current()) setLoading(false);
    }
  }
  useEffect(() => {
    setData({});
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
    } …6254 tokens truncated…  <p className="preserve-lines">{h.notes}</p>
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
                title="Create employee test account"
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
          Lead Connect · Separate hotel operations test project · No PMS
          connection
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
