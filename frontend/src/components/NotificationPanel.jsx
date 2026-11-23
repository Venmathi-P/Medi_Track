import { useEffect, useState } from "react";
import { ErrorNote } from "./Feedback";
import { enableNotifications, notifyEnabled, notifyPermission, notifySupported, onNotifyChange, setNotifyPref, showNotification } from "../notify";

export default function NotificationPanel() {
  const [on, setOn] = useState(notifyEnabled());
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => onNotifyChange(() => setOn(notifyEnabled())), []);

  async function turnOn() {
    setError("");
    try {
      await enableNotifications();
    } catch (e) {
      setError(e.message);
    }
  }
  function test() {
    setMsg("");
    const ok = showNotification("MediTrack test", "Notifications are working. You will be alerted when a dose is due.", "test");
    setMsg(ok ? "Test notification sent. Check the corner of your screen." : "Could not show a notification.");
  }

  const supported = notifySupported();
  const blocked = notifyPermission() === "denied";

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Browser notifications</h2>
        <span className={`chip ${on ? "chip-green" : "chip-neutral"}`}>{on ? "On" : "Off"}</span>
      </div>
      {!supported ? (
        <p className="muted">This browser does not support notifications. Try Chrome, Edge or Firefox.</p>
      ) : (
        <>
          <p className="muted">
            Get a pop-up when a dose is due, and a second one 15 minutes later if it is still Pending. It works while MediTrack
            is open in any browser tab (a background tab is fine). Closing the browser stops alerts.
          </p>
          <ErrorNote>{error}</ErrorNote>
          {blocked && !error && (
            <ErrorNote>Notifications are blocked for this site. Click the lock icon next to the address bar and allow Notifications.</ErrorNote>
          )}
          <div className="actions-left">
            {on ? (
              <>
                <button className="btn btn-ghost" onClick={test}>Send a test notification</button>
                <button className="btn btn-ghost" onClick={() => setNotifyPref(false)}>Turn off</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={turnOn}>Turn on notifications</button>
            )}
          </div>
          {msg && <p className="muted" role="status">{msg}</p>}
        </>
      )}
    </section>
  );
}
