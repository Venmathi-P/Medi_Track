const BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "meditrack_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

function errorMessage(data, status) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const field = e.loc?.filter((p) => p !== "body").slice(-1)[0];
        return field ? `${String(field).replace(/_/g, " ")}: ${e.msg}` : e.msg;
      })
      .join(". ");
  }
  return `Request failed (${status})`;
}

async function request(path, { method = "GET", body, form, blob, auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }
  if (res.status === 401 && token && !path.startsWith("/auth/")) onUnauthorized();
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new Error(errorMessage(data, res.status));
  }
  if (res.status === 204) return null;
  return blob ? res.blob() : res.json();
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));
  return s.toString() ? `?${s}` : "";
};

export const api = {
  auth: {
    login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
    register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }),
    me: () => request("/auth/me"),
  },
  medicines: {
    list: (on, q) => request(`/medicines${qs({ on, q })}`),
    create: (body) => request("/medicines", { method: "POST", body }),
    update: (id, body) => request(`/medicines/${id}`, { method: "PUT", body }),
    importBulk: (items, on) => request(`/medicines/import${qs({ on })}`, { method: "POST", body: { items } }),
    refills: (on) => request(`/medicines/refills${qs({ on })}`),
    setStock: (id, quantity) => request(`/medicines/${id}/stock`, { method: "PATCH", body: { quantity } }),
    remove: (id) => request(`/medicines/${id}`, { method: "DELETE" }),
  },
  reminders: {
    list: () => request("/reminders"),
    create: (body) => request("/reminders", { method: "POST", body }),
    patch: (id, body) => request(`/reminders/${id}`, { method: "PATCH", body }),
    remove: (id) => request(`/reminders/${id}`, { method: "DELETE" }),
    doses: (on) => request(`/reminders/doses${qs({ on })}`),
    setDose: (id, status) => request(`/reminders/doses/${id}`, { method: "PATCH", body: { status } }),
  },
  prescriptions: {
    list: () => request("/prescriptions"),
    upload: (form) => request("/prescriptions", { method: "POST", form }),
    file: (id, download) => request(`/prescriptions/${id}/file${download ? "?download=true" : ""}`, { blob: true }),
    extract: (id, on) => request(`/prescriptions/${id}/extract${qs({ on })}`, { method: "POST" }),
    remove: (id) => request(`/prescriptions/${id}`, { method: "DELETE" }),
  },
  emergency: {
    get: () => request("/emergency"),
    save: (body) => request("/emergency", { method: "PUT", body }),
    regenerate: () => request("/emergency/regenerate", { method: "POST" }),
  },
  publicEmergency: (token) => request(`/public/emergency/${encodeURIComponent(token)}`, { auth: false }),
  report: (start, end, on) => request(`/reports/adherence${qs({ start, end, on })}`),
  history: (period, on) => request(`/history${qs({ period, on })}`),
  dashboard: (on) => request(`/dashboard${qs({ on })}`),
};
