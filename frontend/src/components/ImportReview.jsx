import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Chip } from "./Chips";
import { ErrorNote, Spinner } from "./Feedback";
import Modal from "./Modal";
import { isoDate } from "../util";

let nextKey = 1;
const toRow = (c) => ({
  key: nextKey++, include: !c.already_exists, already_exists: c.already_exists,
  name: c.name, dosage: c.dosage, frequency: c.frequency, quantity: c.quantity,
  low_stock_threshold: c.low_stock_threshold, start_date: c.start_date, expiry_date: c.expiry_date || "",
  notes: c.notes || "", reminder_times: c.reminder_times, warnings: c.warnings, schedule_note: c.schedule_note,
});
const blankRow = () => toRow({
  name: "", dosage: "", frequency: "", quantity: 0, low_stock_threshold: 10, start_date: isoDate(), expiry_date: "",
  notes: null, reminder_times: [], warnings: [], schedule_note: null, already_exists: false,
});

/** Reads an uploaded PDF, shows the medicines it found for review, then adds them with their reminders. */
export default function ImportReview({ prescription, onClose }) {
  const [phase, setPhase] = useState("loading"); // loading | review | message | done
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.prescriptions
      .extract(prescription.id, isoDate())
      .then((res) => {
        if (cancelled) return;
        setMessage(res.message);
        if (res.status === "ok") {
          setRows(res.medicines.map(toRow));
          setPhase("review");
        } else if (res.status === "no_medicines") {
          setRows([blankRow()]);
          setPhase("review");
        } else {
          setPhase("message");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setPhase("message");
      });
    return () => { cancelled = true; };
  }, [prescription.id]);

  const patch = (key, changes) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  const set = (key, field) => (e) => patch(key, { [field]: e.target.value });
  const setTime = (row, i, v) => patch(row.key, { reminder_times: row.reminder_times.map((t, j) => (j === i ? v : t)) });
  const chosen = rows.filter((r) => r.include);

  async function submit() {
    setError("");
    if (chosen.length === 0) return setError("Tick at least one medicine to add.");
    for (const r of chosen) {
      const who = r.name.trim() || "A medicine";
      if (!r.name.trim() || !r.dosage.trim() || !r.frequency.trim()) return setError(`${who}: name, dosage and frequency are required.`);
      if (r.quantity === "" || Number(r.quantity) < 0) return setError(`${who}: quantity must be 0 or more.`);
      if (!r.expiry_date) return setError(`${who}: enter the expiry date (check the pack).`);
      if (r.expiry_date < r.start_date) return setError(`${who}: the expiry date is before the start date.`);
      if (r.reminder_times.some((t) => !t)) return setError(`${who}: fill in or remove the empty reminder time.`);
    }
    const items = chosen.map((r) => ({
      name: r.name.trim(), dosage: r.dosage.trim(), frequency: r.frequency.trim(),
      quantity: Number(r.quantity), low_stock_threshold: Number(r.low_stock_threshold),
      start_date: r.start_date, expiry_date: r.expiry_date, notes: r.notes.trim() || null,
      reminder_times: r.reminder_times,
    }));
    setBusy(true);
    try {
      setResult(await api.medicines.importBulk(items, isoDate()));
      setPhase("done");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const title = `Add medicines from "${prescription.title}"`;

  if (phase === "loading") {
    return <Modal title={title} onClose={onClose} wide><Spinner /></Modal>;
  }

  if (phase === "message") {
    return (
      <Modal title={title} onClose={onClose} wide>
        {error ? <ErrorNote>{error}</ErrorNote> : <p>{message}</p>}
        <div className="modal-foot">
          <Link className="btn btn-ghost" to="/medicines" onClick={onClose}>Go to Medicines</Link>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  if (phase === "done") {
    const reminders = result.created.reduce((n, c) => n + c.reminders, 0);
    return (
      <Modal title="Medicines added" onClose={onClose} wide>
        <p role="status">
          Added <strong>{result.created.length}</strong> medicine{result.created.length === 1 ? "" : "s"} and set{" "}
          <strong>{reminders}</strong> daily reminder{reminders === 1 ? "" : "s"}.
        </p>
        {result.created.length > 0 && (
          <ul className="plain">
            {result.created.map((c) => (
              <li key={c.id}><strong>{c.name}</strong><span className="muted">{c.reminders ? `${c.reminders} reminder${c.reminders === 1 ? "" : "s"}` : "no reminder"}</span></li>
            ))}
          </ul>
        )}
        {result.skipped.length > 0 && (
          <p className="muted">Skipped: {result.skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}.</p>
        )}
        <div className="modal-foot">
          <Link className="btn btn-ghost" to="/medicines" onClick={onClose}>View medicines</Link>
          <Link className="btn btn-primary" to="/reminders" onClick={onClose}>View reminders</Link>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <p>{message}</p>
      <p className="muted small">
        Check each row before adding. The expiry date is pre-filled with the last day of the course. Replace it with the date
        printed on the pack if you have it. Untick anything you do not want.
      </p>
      <ErrorNote>{error}</ErrorNote>

      <ul className="review-list">
        {rows.map((r) => (
          <li key={r.key} className={r.include ? "review-row" : "review-row off"}>
            <div className="review-top">
              <input type="checkbox" checked={r.include} aria-label={`Add ${r.name || "this medicine"}`} onChange={(e) => patch(r.key, { include: e.target.checked })} />
              <input aria-label="Medicine name" placeholder="Medicine name" maxLength={150} value={r.name} onChange={set(r.key, "name")} />
              <input aria-label="Dosage" placeholder="Dosage" maxLength={100} value={r.dosage} onChange={set(r.key, "dosage")} />
              <input aria-label="Frequency" placeholder="Frequency" maxLength={100} value={r.frequency} onChange={set(r.key, "frequency")} />
              {r.already_exists && <Chip tone="blue">Already added</Chip>}
            </div>
            <div className="review-mid">
              <label className="field"><span>Quantity</span>
                <input type="number" min="0" value={r.quantity} onChange={set(r.key, "quantity")} /></label>
              <label className="field"><span>Starts</span>
                <input type="date" value={r.start_date} onChange={set(r.key, "start_date")} /></label>
              <label className="field"><span>Expiry date</span>
                <input type="date" min={r.start_date} value={r.expiry_date} onChange={set(r.key, "expiry_date")} /></label>
            </div>
            <div className="review-times">
              <span className="muted small">Reminders at</span>
              {r.reminder_times.length === 0 && <span className="muted small">none</span>}
              {r.reminder_times.map((t, i) => (
                <span className="time-chip" key={i}>
                  <input type="time" aria-label={`Reminder time ${i + 1} for ${r.name || "this medicine"}`} value={t} onChange={(e) => setTime(r, i, e.target.value)} />
                  <button type="button" aria-label="Remove this reminder time" onClick={() => patch(r.key, { reminder_times: r.reminder_times.filter((_, j) => j !== i) })}>×</button>
                </span>
              ))}
              {r.reminder_times.length < 6 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(r.key, { reminder_times: [...r.reminder_times, "08:00"] })}>Add time</button>
              )}
            </div>
            {r.notes && <p className="muted small review-note">Notes: {r.notes}</p>}
            {r.schedule_note && <p className="muted small review-note">{r.schedule_note}</p>}
            {r.warnings.map((w) => <p key={w} className="field-error review-note">{w}</p>)}
          </li>
        ))}
      </ul>

      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={() => setRows([...rows, blankRow()])}>Add another row</button>
        <span className="actions-left no-margin">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={busy || chosen.length === 0} onClick={submit}>
            {busy ? "Adding…" : `Add ${chosen.length} medicine${chosen.length === 1 ? "" : "s"} and set reminders`}
          </button>
        </span>
      </div>
    </Modal>
  );
}
