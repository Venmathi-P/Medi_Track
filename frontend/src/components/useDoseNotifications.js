import { useEffect, useState } from "react";
import { api } from "../api";
import { notifyEnabled, onNotifyChange, showNotification } from "../notify";
import { formatTime, isoDate } from "../util";

const SENT_KEY = "meditrack_notified";
const NUDGE_AFTER_MIN = 15; // second alert if the dose is still Pending
const STALE_AFTER_MIN = 180; // never alert for doses more than 3 h overdue

function loadSent() {
  const today = isoDate();
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
    if (v.day === today && Array.isArray(v.ids)) return v;
  } catch {
    /* ignore corrupt value */
  }
  return { day: today, ids: [] };
}

/** While MediTrack is open in a browser tab, alert when a dose is due and again if it is still Pending. */
export default function useDoseNotifications() {
  const [enabled, setEnabled] = useState(notifyEnabled());
  useEffect(() => onNotifyChange(() => setEnabled(notifyEnabled())), []);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;

    async function check() {
      try {
        const doses = await api.reminders.doses(isoDate());
        if (stopped) return;
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const sent = loadSent();
        let changed = false;
        for (const d of doses) {
          if (d.status !== "Pending") continue;
          const [h, m] = d.scheduled_time.split(":").map(Number);
          const late = nowMin - (h * 60 + m);
          if (late < 0 || late > STALE_AFTER_MIN) continue;
          const stage = late >= NUDGE_AFTER_MIN ? "nudge" : "due";
          const key = `${d.id}:${stage}`;
          if (sent.ids.includes(key)) continue;
          const time = formatTime(d.scheduled_time);
          const ok =
            stage === "due"
              ? showNotification(`Time to take ${d.medicine_name}`, `${d.dosage} · scheduled for ${time}`, key)
              : showNotification(`Still pending: ${d.medicine_name}`, `${d.dosage} · was due at ${time}. Mark it Taken or Skipped in MediTrack.`, key);
          if (ok) {
            sent.ids.push(key);
            changed = true;
          }
        }
        if (changed) localStorage.setItem(SENT_KEY, JSON.stringify(sent));
      } catch {
        /* offline or server down: try again next tick */
      }
    }

    check();
    const timer = setInterval(check, 30000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled]);
}
