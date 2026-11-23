import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { Chip, DoseChip, ExpiryChip, StockChip } from "../components/Chips";
import DoseRow from "../components/DoseRow";
import RefillPanel from "../components/RefillPanel";
import { formatDate, formatDateTime, formatTime, greeting, isoDate } from "../util";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refills, setRefills] = useState([]);

  const load = useCallback(async () => {
    try {
      const [dash, rf] = await Promise.all([api.dashboard(isoDate()), api.medicines.refills(isoDate())]);
      setData(dash);
      setRefills(rf);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <ErrorNote onRetry={load}>{error}</ErrorNote> : <Spinner />;

  const alerts = data.low_stock.length + data.near_expiry.length + data.expired.length;
  const t = data.today;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={formatDate(isoDate(), { weekday: "long", day: "numeric", month: "long" })}
      />
      <ErrorNote>{error}</ErrorNote>

      <dl className="ledger">
        <div><dt>Medicines</dt><dd>{data.total_medicines}</dd></div>
        <div><dt>Active reminders</dt><dd>{data.active_reminders}</dd></div>
        <div><dt>Doses taken today</dt><dd>{t.taken}<small>/{t.total}</small></dd></div>
        <div><dt>Alerts</dt><dd className={alerts ? "warn" : ""}>{alerts}</dd></div>
      </dl>

      <div className="grid-2">
        <section className="panel">
          <h2>Upcoming doses today</h2>
          {data.upcoming.length === 0 ? (
            <Empty title={t.total ? "All of today's doses are logged" : "No doses scheduled today"}>
              {t.total ? "Nothing left to take." : <>Add a schedule on the <Link to="/reminders">Reminders</Link> page.</>}
            </Empty>
          ) : (
            <ul className="timeline">
              {data.upcoming.map((d) => <DoseRow key={d.id} dose={d} onChange={load} />)}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Needs attention</h2>
            <Link to="/stock" className="link-sm">Manage stock</Link>
          </div>
          {alerts === 0 ? (
            <Empty title="No stock or expiry alerts" />
          ) : (
            <ul className="plain">
              {data.expired.map((m) => (
                <li key={`e${m.id}`}><span><strong>{m.name}</strong><small className="muted block">Expired {formatDate(m.expiry_date)}</small></span><ExpiryChip med={m} /></li>
              ))}
              {data.near_expiry.map((m) => (
                <li key={`n${m.id}`}><span><strong>{m.name}</strong><small className="muted block">Expires {formatDate(m.expiry_date)}</small></span><ExpiryChip med={m} /></li>
              ))}
              {data.low_stock.map((m) => (
                <li key={`l${m.id}`}><span><strong>{m.name}</strong><small className="muted block">{m.quantity} left (alert at {m.low_stock_threshold})</small></span><StockChip med={m} /></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Refill forecast</h2>
          <Link to="/stock" className="link-sm">See all</Link>
        </div>
        <RefillPanel refills={refills} limit={5} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent activity</h2>
          <Link to="/history" className="link-sm">Full history</Link>
        </div>
        {data.recent_history.length === 0 ? (
          <Empty title="No doses logged yet">Mark a dose as Taken or Skipped and it will show up here.</Empty>
        ) : (
          <ul className="plain">
            {data.recent_history.map((d) => (
              <li key={d.id}>
                <span>
                  <strong>{d.medicine_name}</strong> <span className="muted">{d.dosage}</span>
                  <small className="muted block">Scheduled {formatDate(d.scheduled_date, { day: "numeric", month: "short" })}, {formatTime(d.scheduled_time)}
                    {d.acted_at && ` · logged ${formatDateTime(d.acted_at)}`}</small>
                </span>
                <DoseChip dose={d} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
