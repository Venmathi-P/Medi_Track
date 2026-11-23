// Browser (Web Notifications API) helpers. The on/off choice is stored per browser.
const KEY = "meditrack_notify";
const EVT = "meditrack-notify-change";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : "unsupported");
export const notifyEnabled = () => localStorage.getItem(KEY) === "on" && notifyPermission() === "granted";

export function setNotifyPref(on) {
  localStorage.setItem(KEY, on ? "on" : "off");
  window.dispatchEvent(new Event(EVT));
}
export function onNotifyChange(cb) {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}

export async function enableNotifications() {
  if (!notifySupported()) throw new Error("This browser does not support notifications.");
  const result = await Notification.requestPermission();
  if (result !== "granted") {
    throw new Error(
      result === "denied"
        ? "Notifications are blocked for this site. Click the lock icon next to the address bar, allow Notifications, then try again."
        : "Permission was not granted."
    );
  }
  setNotifyPref(true);
}

export function showNotification(title, body, tag) {
  try {
    const n = new Notification(title, { body, tag, requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
