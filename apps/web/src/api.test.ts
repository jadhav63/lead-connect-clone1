import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, login, forgetSession, logout } from "./api";
const fixturePassword = crypto.randomUUID();
const response = (status: number, body: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;
beforeEach(() => {
  forgetSession();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("session transport", () => {
  it("uses bearer access tokens in memory and credentialed cookies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { accessToken: "disposable-access" }),
      )
      .mockResolvedValueOnce(response(200, { id: "room" }));
    vi.stubGlobal("fetch", fetcher);
    await login("fixture@example.test", fixturePassword, "FICTIONAL");
    await api("/rooms");
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer disposable-access",
    );
    expect(fetcher.mock.calls[1][1].credentials).toBe("include");
  });
  it("single-flights refresh requests so concurrent page loads do not replay refresh cookies", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async (url: string) =>
        url.endsWith("/auth/refresh")
          ? response(200, { accessToken: "disposable-access" })
          : response(200, []),
      );
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([api("/rooms"), api("/dashboard")]);
    expect(
      fetcher.mock.calls.filter((c) => String(c[0]).endsWith("/auth/refresh")),
    ).toHaveLength(1);
  });
  it("stops when no cookie session exists instead of retrying indefinitely", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response(401, { error: "Invalid session" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api("/rooms")).rejects.toThrow("Sign in");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("clears the in-memory session even when logout fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { accessToken: "disposable-access" }),
      )
      .mockResolvedValueOnce(response(500, { error: "Unavailable" }))
      .mockResolvedValueOnce(response(401, {}));
    vi.stubGlobal("fetch", fetcher);
    await login("fixture@example.test", fixturePassword, "FICTIONAL");
    await expect(logout()).rejects.toThrow("Unavailable");
    await expect(api("/rooms")).rejects.toThrow("Sign in");
  });
});

it("explains network failures without showing raw transport diagnostics", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(login("fixture@example.test", fixturePassword, "FICTIONAL")).rejects.toThrow("Cannot reach the server");
});
it("handles a proxy HTML error without showing a JSON parser error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 502, ok: false, json: async () => { throw new SyntaxError("Unexpected token <"); } }));
  await expect(login("fixture@example.test", fixturePassword, "FICTIONAL")).rejects.toThrow("unreadable response");
});
it("reports a refresh outage without misreporting an expired session and recovers on retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(503, {})).mockResolvedValueOnce(response(200, { accessToken: 'recovered' })).mockResolvedValueOnce(response(200, []));
  vi.stubGlobal('fetch', fetcher);
  await expect(api('/rooms')).rejects.toThrow('temporarily unavailable');
  await expect(api('/rooms')).resolves.toEqual([]);
});
it('coordinates refresh through a browser-wide lock when supported', async () => {
  const lock = vi.fn(async (_name, work) => work());
  vi.stubGlobal('navigator', { locks: { request: lock } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(200, { accessToken: 'disposable' })).mockResolvedValueOnce(response(200, [])));
  await api('/rooms');
  expect(lock).toHaveBeenCalledWith('lead-connect-session', expect.any(Function));
});
