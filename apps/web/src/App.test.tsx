// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import App from "./App";
const { mockAPI } = vi.hoisted(() => ({ mockAPI: vi.fn() }));
vi.mock("./api", () => ({ api: mockAPI, login: vi.fn(), logout: vi.fn(), forgetSession: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const identity = { user: { id: "test-manager", name: "Fictional Manager" }, roles: ["MANAGER"], propertyId: "test-property" };
function deferred<T>() { let resolve!: (v: T) => void; let reject!: (v: Error) => void; const promise = new Promise<T>((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function defaults(path: string) {
  if (path === "/auth/me") return identity;
  if (path === "/properties/current") return { name: "Fictional Hotel" };
  if (["/rooms", "/employees", "/maintenance", "/notifications", "/audit"].includes(path)) return [];
  if (path.startsWith("/housekeeping")) return [];
  return {};
}
it('lets an employee change their own password and signs them out without exposing it', async () => {
  mockAPI.mockImplementation((path: string) => Promise.resolve(path === '/auth/me' ? { ...identity, roles: ['HOUSEKEEPING'] } : defaults(path)));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^Account$/ }));
  const password = crypto.randomUUID();
  fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('New password', { exact: true }), { target: { value: password + 'new' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password + 'new' } });
  fireEvent.click(screen.getByRole('button', { name: /^Change password$/ }));
  expect(await screen.findByText('Password changed. Sign in with your new password.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Sign in$/ })).toBeTruthy();
  expect(mockAPI).toHaveBeenCalledWith('/auth/password', 'POST', { currentPassword: password, newPassword: password + 'new' });
});
describe("dashboard loading and navigation", () => {
  it("shows the dirty checkout queue, opens assignment by default, and loads overdue work separately", async () => {
    mockAPI.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(identity);
      if (path === "/rooms") return Promise.resolve([{ id: "room-901", number: "901", floor: 1, roomType: "RM2", status: "DIRTY", occupancyStatus: "DEPARTURE", notes: null, version: 1 }]);
      if (path.startsWith("/housekeeping/overdue")) return Promise.resolve([]);
      if (path.startsWith("/housekeeping?")) return Promise.resolve([]);
      return Promise.resolve(defaults(path));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Housekeeping$/ }));
    expect(await screen.findByText("Dirty checkout and stayover queue · " + new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix" }).format(new Date()))).toBeTruthy();
    expect((await screen.findAllByText("Room 901")).length).toBeGreaterThan(0);
    expect(screen.getByText("Checkout")).toBeTruthy();
    expect((screen.getByText("Assign a room").closest("details") as HTMLDetailsElement).open).toBe(true);
    expect(mockAPI).toHaveBeenCalledWith(expect.stringMatching(/^\/housekeeping\/overdue\?before=\d{4}-\d{2}-\d{2}$/));
  });
  it('clears array data before rendering a different operational page', async () => {
    mockAPI.mockImplementation((path: string) => Promise.resolve(path.startsWith('/housekeeping') ? [{ id: 'cleaning', room: { id: 'room', number: '901', notes: null }, assignedToId: null, assignedTo: null, cleaningType: 'CHECKOUT', status: 'PENDING' }] : defaults(path)));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Housekeeping$/ }));
    await screen.findAllByText('901');
    fireEvent.click(screen.getByRole('button', { name: /^Maintenance$/ }));
    expect(await screen.findByRole('heading', { name: /^Maintenance$/, level: 1 })).toBeTruthy();
    await screen.findByText('No maintenance tickets available.');
  });
  it("announces loading and ignores a previous page response after navigation", async () => {
    const old = deferred<unknown>();
    mockAPI.mockImplementation((path: string) => path.startsWith("/dashboard") ? old.promise : Promise.resolve(defaults(path)));
    render(<App />);
    await screen.findByText("Loading dashboard…");
    fireEvent.click(screen.getByRole("button", { name: "Housekeeping" }));
    await waitFor(() => expect(screen.queryByText("Loading housekeeping…")).toBeNull());
    await act(async () => { old.resolve({ openMaintenance: 900 }); });
    expect(screen.getByRole("heading", { name: "Housekeeping", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("No cleaning assignments for this date.")).toBeTruthy();
  });
  it("ignores an old failure after the new page has loaded", async () => {
    const old = deferred<unknown>();
    mockAPI.mockImplementation((path: string) => path.startsWith("/dashboard") ? old.promise : Promise.resolve(defaults(path)));
    render(<App />);
    await screen.findByText("Loading dashboard…");
    fireEvent.click(screen.getByRole("button", { name: "Rooms" }));
    await waitFor(() => expect(screen.queryByText("Loading rooms…")).toBeNull());
    await act(async () => { old.reject(new Error("Old page failed")); });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("offers Retry after a failed load and clears the error on success", async () => {
    let fail = true;
    mockAPI.mockImplementation((path: string) => path.startsWith("/dashboard") && fail ? Promise.reject(new Error("Temporary test failure")) : Promise.resolve(defaults(path)));
    render(<App />);
    await screen.findByRole("alert");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Loading dashboard…")).toBeNull());
    expect(screen.getByText("Your daily operating picture.")).toBeTruthy();
  });
  it("loads and displays the property monthly employee cleaning report", async () => {
    mockAPI.mockImplementation((path: string) => {
      if (path.startsWith("/reports?month=")) return Promise.resolve({
        month: path.split("=")[1],
        totals: { scheduled: 3, completed: 1, verified: 1, cancelled: 0, estimatedCompletedMinutes: 30, trackedElapsedMinutes: 27, timedTaskCount: 1 },
        employees: [{ employeeId: "cleaner", employeeName: "Test Housekeeper", scheduled: 2, inProgress: 0, completed: 0, verified: 1, pending: 1, cancelled: 0, estimatedCompletedMinutes: 30, trackedElapsedMinutes: 27, timedTaskCount: 1 }],
      });
      return Promise.resolve(defaults(path));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reports" }));
    fireEvent.click(await screen.findByRole("button", { name: "Monthly report" }));
    expect(await screen.findByText(/Monthly employee cleaning totals/)).toBeTruthy();
    expect(screen.getByText("Test Housekeeper")).toBeTruthy();
    expect(screen.getByLabelText("Report month")).toBeTruthy();
    expect(screen.getByText("Estimated completed minutes")).toBeTruthy();
    expect(screen.getByText("Tracked elapsed minutes")).toBeTruthy();
    expect(screen.getAllByText("27")).toHaveLength(2);
    expect(mockAPI).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\?month=\d{4}-\d{2}$/));
  });
  it("shows unread notifications and uses the read action", async () => {
    mockAPI.mockImplementation((path: string) => Promise.resolve(
      path === "/notifications" ? [{ id: "notice-1", title: "Cleaning assignment", message: "Room 901 was assigned to you.", type: "TASK_ASSIGNED", createdAt: "2026-11-08T08:00:00.000Z", isRead: false }] : defaults(path),
    ));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Room 901 was assigned to you.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() => expect(mockAPI).toHaveBeenCalledWith("/notifications/notice-1/read", "PATCH", {}));
  });
  it("shows and filters the manager activity feed", async () => {
    mockAPI.mockImplementation((path: string) => Promise.resolve(
      path === "/audit" ? [{ id: "audit-1", action: "CREATE", entityType: "Room", entityId: "room-1", createdAt: "2026-11-08T08:00:00.000Z", actor: { name: "Test Manager" } }] : defaults(path),
    ));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Activity" }));
    expect(await screen.findByText("Recent property activity")).toBeTruthy();
    expect(screen.getByText("Test Manager")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter activity"), { target: { value: "maintenance" } });
    expect(screen.getByText("No matching activity.")).toBeTruthy();
  });
});
