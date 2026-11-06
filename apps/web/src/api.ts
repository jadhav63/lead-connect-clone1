const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
let token = "";
let refreshing: Promise<boolean> | null = null;
export function forgetSession() {
  token = "";
}
export async function login(
  email: string,
  password: string,
  propertyCode: string,
) {
  const res = await fetch(base + "/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, propertyCode }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Login failed");
  token = body.accessToken;
}
async function refresh() {
  if (!refreshing)
    refreshing = fetch(base + "/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) {
          token = "";
          return false;
        }
        token = (await res.json()).accessToken;
        return true;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const send = () =>
    fetch(base + "/api" + path, {
      method,
      credentials: "include",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  if (!token && path !== "/auth/logout" && !(await refresh()))
    throw new Error("Sign in to continue");
  let res = await send();
  if (res.status === 401 && path !== "/auth/logout" && (await refresh()))
    res = await send();
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
}
export async function logout() {
  try {
    await api("/auth/logout", "POST", {});
  } finally {
    forgetSession();
  }
}
