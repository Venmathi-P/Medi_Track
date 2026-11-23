import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { DoseChip } from "../components/Chips";
import { addDays, formatDate, formatDateTime, formatTime, isoDate } from "../util";

export default function History() {
  const [period, setPeriod] = useState("daily");
  const [on, setOn] = useState(isoDate());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setData(null);
    try { setData(await api.history(period, on)); setError(""); } catch (e) { setError(e.message); }
  }, [period, on]);
  useEffect(() => { load(); }, [load]);

  const step = period === "daily" ? 1 : 7;
  const today = isoDate();
  const byDay = (data?.doses || []).reduce((acc, d) => {
    (acc[d.scheduled_date] ||= []).push(d);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title="Medication history" subtitle="Your dose records by day or week." />
      <ErrorNote onRetry={load}>{error}</ErrorNote>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Period">
          <button type="button" aria-pressed={period === "daily"} onClick={() => setPeriod("daily")}>Daily</button>
          <button type="button" aria-pressed={period === "weekly"} onClick={() => setPeriod("weekly")}>Weekly</button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOn(addDays(on, -step))}>Previous {period === "daily" ? "day" : "week"}</button>
        <label className="field inline"><span className="sr-only">Ending on</span>
          <input type="date" max={today} value={on} onChange={(e) => e.target.value && setOn(e.target.value > today ? today : e.target.value)} /></label>
        <button className="btn btn-ghost btn-sm" disabled={on >= today} onClick={() => setOn(addDays(on, step) > today ? today : addDays(on, step))}>Next {period === "daily" ? "day" : "week"}</button>
      </div>

      {!data ? <Spinner /> : (
        <>
          <p className="range-label">
            {data.start === data.end ? formatDate(data.end, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : `${formatDate(data.start, { day: "numeric", month: "short" })} to ${formatDate(data.end, { day: "numeric", month: "short", year: "numeric" })}`}
          </p>
          <dl className="ledger">
            <div><dt>Taken</dt><dd>{data.summary.taken}</dd></div>
            <div><dt>Skipped</dt><dd>{data.summary.skipped}</dd></div>
            <div><dt>Pending or missed</dt><dd>{data.summary.pending}</dd></div>
            <div><dt>Taken on schedule</dt><dd>{data.summary.adherence_percent}<small>%</small></dd></div>
          </dl>

          {data.doses.length === 0 ? (
            <Empty title="No doses in this period">Doses appear here once you have active reminders.</Empty>
          ) : (
            Object.entries(byDay).map(([day, doses]) => (
              <section className="panel" key={day}>
                <h2>{formatDate(day, { weekday: "long", day: "numeric", month: "short" })}</h2>
                <ul className="plain">
                  {doses.map((d) => (
                    <li key={d.id}>
                      <span>
                        <strong>{formatTime(d.scheduled_time)}</strong> · {d.medicine_name} <span className="muted">{d.dosage}</span>
                        {d.acted_at && <small className="muted block">Logged {formatDateTime(d.acted_at)}</small>}
                      </span>
                      <DoseChip dose={d} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </>
  );
}
