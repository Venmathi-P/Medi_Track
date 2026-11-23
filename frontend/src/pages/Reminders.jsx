import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import DoseRow from "../components/DoseRow";
import NotificationPanel from "../components/NotificationPanel";
import { formatTime, isoDate, timeInput } from "../util";

export default function Reminders() {
  const [meds, setMeds] = useState(null);
  const [reminders, setReminders] = useState(null);
  const [doses, setDoses] = useState(null);
  const [form, setForm] = useState({ medicine_id: "", remind_time: "08:00" });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, r, d] = await Promise.all([api.medicines.list(isoDate()), api.reminders.list(), api.reminders.doses(isoDate())]);
      setMeds(m); setReminders(r); setDoses(d); setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const usable = (meds || []).filter((m) => m.expiry_status !== "expired");

  async function add(e) {
    e.preventDefault();
    setFormError("");
    try {
      await api.reminders.create({ medicine_id: Number(form.medicine_id), remind_time: form.remind_time, start_date: isoDate() });
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function toggle(r) {
    try { await api.reminders.patch(r.id, { is_active: !r.is_active }); load(); } catch (e) { setError(e.message); }
  }
  async function remove(r) {
    if (!window.confirm(`Delete the ${formatTime(r.remind_time)} reminder for ${r.medicine_name}? Its dose history will be deleted too.`)) return;
    try { await api.reminders.remove(r.id); load(); } catch (e) { setError(e.message); }
  }

  if (!reminders) return error ? <ErrorNote onRetry={load}>{error}</ErrorNote> : <Spinner />;

  return (
    <>
      <PageHeader title="Reminders" subtitle="Schedule daily dose times and log each dose as you go." />
      <ErrorNote>{error}</ErrorNote>
      <NotificationPanel />

      <div className="grid-2">
        <section className="panel">
          <h2>Today's doses</h2>
          {doses.length === 0 ? (
            <Empty title="No doses scheduled today">Add a reminder and today's doses will appear here.</Empty>
          ) : (
            <ul className="timeline">
              {doses.map((d) => (
                <DoseRow key={d.id} dose={d} onChange={(u) => setDoses(doses.map((x) => (x.id === u.id ? u : x)))} />
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Schedule a reminder</h2>
          {usable.length === 0 ? (
            <Empty title="No usable medicines">Add a medicine that hasn't expired first.</Empty>
          ) : (
            <form onSubmit={add} className="stack">
              <ErrorNote>{formError}</ErrorNote>
              <label className="field"><span>Medicine</span>
                <select required value={form.medicine_id} onChange={(e) => setForm({ ...form, medicine_id: e.target.value })}>
                  <option value="">Choose a medicine</option>
                  {usable.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.dosage})</option>)}
                </select></label>
              <label className="field"><span>Time each day</span>
                <input type="time" required value={form.remind_time} onChange={(e) => setForm({ ...form, remind_time: e.target.value })} /></label>
              <button className="btn btn-primary">Add reminder</button>
            </form>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>All reminders</h2>
        {reminders.length === 0 ? (
          <Empty title="No reminders yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Time</th><th>Medicine</th><th>Dosage</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className={r.is_active ? "" : "dim"}>
                    <td className="num-l">{formatTime(timeInput(r.remind_time))}</td>
                    <td><strong>{r.medicine_name}</strong></td>
                    <td>{r.dosage}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={r.is_active} onChange={() => toggle(r)} />
                        <span>{r.is_active ? "On" : "Paused"}</span>
                      </label>
                    </td>
                    <td className="row-actions"><button className="btn btn-danger btn-sm" onClick={() => remove(r)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
