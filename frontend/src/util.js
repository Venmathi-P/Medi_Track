const pad = (n) => String(n).padStart(2, "0");
const parse = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso, n) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
export const formatDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  parse(iso).toLocaleDateString(undefined, opts);
export const formatTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};
export const timeInput = (t) => t.slice(0, 5);
export const formatDateTime = (s) =>
  new Date(s).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const formatBytes = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export const isOverdue = (dose) => {
  if (dose.status !== "Pending") return false;
  const today = isoDate();
  if (dose.scheduled_date < today) return true;
  if (dose.scheduled_date > today) return false;
  const now = new Date();
  const [h, m] = dose.scheduled_time.split(":").map(Number);
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
