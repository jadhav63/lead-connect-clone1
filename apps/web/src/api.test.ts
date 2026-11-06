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
