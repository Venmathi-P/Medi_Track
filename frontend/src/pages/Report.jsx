import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { Chip } from "../components/Chips";
import { addDays, formatDate, formatTime, isoDate } from "../util";

const PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "custom", label: "Custom range" },
];

export default function Report() {
  const today = isoDate();
  const [preset, setPreset] = useState("30");
  const [range, setRange] = useState({ start: addDays(today, -29), end: today });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  function choose(id) {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p.days) setRange({ start: addDays(today, -(p.days - 1)), end: today });
  }

  const load = useCallback(async () => {
    setData(null);
    if (range.end < range.start) return setError("The end date must be on or after the start date.");
    if (range.start < addDays(range.end, -92)) return setError("Choose a range of 93 days or less.");
    try {
      setData(await api.report(range.start, range.end, today));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [range, today]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;

  return (
    <>
      <PageHeader title="Doctor report" subtitle="A one-page adherence summary to share at a check-up.">
        <button className="btn btn-primary no-print" disabled={!data} onClick={() => window.print()}>Print or save as PDF</button>
      </PageHeader>

      <div className="toolbar no-print">
        <label className="field inline"><span className="sr-only">Period</span>
          <select value={preset} onChange={(e) => choose(e.target.value)}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></label>
        {preset === "custom" && (
          <>
            <label className="field inline"><span>From</span>
              <input type="date" max={today} value={range.start} onChange={(e) => e.target.value && setRange({ ...range, start: e.target.value })} /></label>
            <label className="field inline"><span>To</span>
              <input type="date" max={today} value={range.end} onChange={(e) => e.target.value && setRange({ ...range, end: e.target.value > today ? today : e.target.value })} /></label>
          </>
        )}
      </div>
      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {!data ? (error ? null : <Spinner />) : (
        <article className="report panel">
          <header className="report-head">
            <div>
              <h2>Medication adherence report</h2>
              <p><strong>{data.patient_name}</strong> <span className="muted">{data.patient_email}</span></p>
            </div>
            <div className="report-meta muted">
              <div>Period: {formatDate(data.start)} to {formatDate(data.end)}</div>
              <div>Generated: {formatDate(data.generated_on)}</div>
            </div>
          </header>

          {t.scheduled === 0 ? (
            <Empty title="No scheduled doses in this period">Add reminders and log doses to build a report.</Empty>
          ) : (
            <>
              <dl className="ledger">
                <div><dt>Doses taken on schedule</dt><dd>{t.adherence_percent ?? "–"}{t.adherence_percent !== null && <small>%</small>}</dd></div>
                <div><dt>Taken</dt><dd>{t.taken}</dd></div>
                <div><dt>Skipped</dt><dd>{t.skipped}</dd></div>
                <div><dt>Missed</dt><dd className={t.missed ? "warn" : ""}>{t.missed}</dd></div>
              </dl>
              <p className="muted small">
                Adherence = taken ÷ (taken + skipped + missed). A dose still Pending after its day counts as missed;
                today's pending doses ({t.pending}) are not counted yet.
              </p>

              <h3>By medicine</h3>
              <div className="table-wrap">
                <table className="table compact">
                  <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th className="num">Taken</th><th className="num">Skipped</th><th className="num">Missed</th><th className="num">Adherence</th></tr></thead>
                  <tbody>
                    {data.per_medicine.map((m) => (
                      <tr key={m.medicine_name + m.dosage}>
                        <td><strong>{m.medicine_name}</strong></td><td>{m.dosage}</td><td>{m.frequency}</td>
                        <td className="num">{m.taken}</td><td className="num">{m.skipped}</td><td className="num">{m.missed}</td>
                        <td className="num">{m.adherence_percent === null ? "–" : `${m.adherence_percent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Day by day</h3>
              <ul className="days">
                {data.daily.map((d) => {
                  const total = d.taken + d.skipped + d.missed + d.pending || 1;
                  const w = (n) => `${(n / total) * 100}%`;
                  return (
                    <li key={d.day}>
                      <span className="day-label">{formatDate(d.day, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="daybar" aria-hidden="true">
                        <i className="seg-taken" style={{ width: w(d.taken) }} />
                        <i className="seg-skipped" style={{ width: w(d.skipped) }} />
                        <i className="seg-missed" style={{ width: w(d.missed) }} />
                        <i className="seg-pending" style={{ width: w(d.pending) }} />
                      </span>
                      <span className="day-counts">{d.taken} taken, {d.skipped} skipped, {d.missed} missed{d.pending ? `, ${d.pending} pending` : ""}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="legend muted small">
                <i className="seg-taken" /> taken <i className="seg-skipped" /> skipped <i className="seg-missed" /> missed <i className="seg-pending" /> pending
              </p>

              <h3>Missed and skipped doses</h3>
              {data.events.length === 0 ? <p className="muted">None in this period.</p> : (
                <div className="table-wrap">
                  <table className="table compact">
                    <thead><tr><th>Date</th><th>Time</th><th>Medicine</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.events.map((e, i) => (
                        <tr key={i}>
                          <td>{formatDate(e.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                          <td>{formatTime(e.time)}</td>
                          <td>{e.medicine_name} <span className="muted">{e.dosage}</span></td>
                          <td><Chip tone={e.state === "Missed" ? "red" : "blue"}>{e.state}</Chip></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <h3>Current medicines</h3>
          {data.current_medicines.length === 0 ? <p className="muted">No medicines on record.</p> : (
            <div className="table-wrap">
              <table className="table compact">
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Expires</th></tr></thead>
                <tbody>
                  {data.current_medicines.map((m) => (
                    <tr key={m.name + m.dosage}><td><strong>{m.name}</strong></td><td>{m.dosage}</td><td>{m.frequency}</td><td>{formatDate(m.expiry_date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted small report-foot">
            Self-recorded in MediTrack to support a conversation with your doctor. It is not a medical record, and it
            reflects what the patient logged, not what was verified.
          </p>
        </article>
      )}
    </>
  );
}
