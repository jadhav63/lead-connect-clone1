const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
async function request(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch { throw new Error("Cannot reach the server. Check your connection and try again. Changes are not confirmed until Saved appears."); }
  finally { clearTimeout(timeout); }
}
async function readResponse(res: Response) {
  if (res.status === 204) return null;
  try { return await res.json(); }
  catch { throw new Error("The server returned an unreadable response. Please try again."); }
}
let token = "";
let refreshing: Promise<boolean> | null = null;
let generation = 0;
async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) return await navigator.locks.request("lead-connect-session", work);
  return work();
}
export function forgetSession() {
  token = "";
  generation += 1;
}
function sessionEnded() {
  forgetSession();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lead-connect-session-ended'));
}
export async function login(
  email: string,
  password: string,
  propertyCode: string,
) {
  const res = await request(base + "/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, propertyCode }),
  });
  const body = await readResponse(res);
  if (!res.ok) throw new Error(body.error ?? "Login failed");
  generation += 1;
  token = body.accessToken;
}
async function refresh() {
  if (!refreshing) refreshing = withSessionLock(async () => {
    const startedGeneration = generation;
    const res = await request(base + "/api/auth/refresh", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (!res.ok) {
      if (res.status === 401) {
        if (startedGeneration === generation) sessionEnded();
        return false;
      }
      throw new Error("The server is temporarily unavailable. Try again when your connection recovers.");
    }
    const body = await readResponse(res);
    if (startedGeneration !== generation) return false;
    token = body.accessToken;
    return true;
  }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const send = () =>
    request(base + "/api" + path, {
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
  if (res.status === 401 && path !== "/auth/logout") {
    if (await refresh()) {
      // Replay only reads. A mutation always requires a fresh explicit employee action.
      if (!['GET','HEAD'].includes(method.toUpperCase())) throw new Error('Session renewed. Refresh current work before submitting again.');
      res = await send();
    }
  }
  if(res.status===401)sessionEnded();
  const body = await readResponse(res);
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
}
export async function redeemAccess(code:string,password:string) {
  const res=await request(base+'/api/auth/redeem-access',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,password})});
  const body=await readResponse(res);
  if(!res.ok)throw new Error(body?.error??'Code could not be redeemed');
  forgetSession();
}
export async function logout() {
  try {
    await withSessionLock(() => api("/auth/logout", "POST", {}));
  } finally {
    forgetSession();
  }
}
