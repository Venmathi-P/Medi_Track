import { useState } from "react";
import { api } from "../api";
import { formatDate, formatTime, isOverdue } from "../util";

const STATUSES = ["Pending", "Taken", "Skipped"];

/** One scheduled dose with a Pending / Taken / Skipped control. */
export default function DoseRow({ dose, onChange, showDate = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status) {
    if (busy || status === dose.status) return;
    setBusy(true);
    setError("");
    try {
      onChange(await api.reminders.setDose(dose.id, status));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const tone = dose.status === "Taken" ? "taken" : dose.status === "Skipped" ? "skipped" : isOverdue(dose) ? "overdue" : "pending";

  return (
    <li className={`dose dose-${tone}`}>
      <div className="dose-time">
        <span className="dot" aria-hidden="true" />
        <span>
          {formatTime(dose.scheduled_time)}
          {showDate && <small className="muted block">{formatDate(dose.scheduled_date, { day: "numeric", month: "short" })}</small>}
        </span>
      </div>
      <div className="dose-body">
        <strong>{dose.medicine_name}</strong>
        <span className="muted">
          {dose.dosage}
          {tone === "overdue" && " · overdue"}
        </span>
        {error && <span className="field-error">{error}</span>}
      </div>
      <div className="seg" role="group" aria-label={`Status for ${dose.medicine_name} at ${formatTime(dose.scheduled_time)}`}>
        {STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={dose.status === s} disabled={busy} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
    </li>
  );
}
