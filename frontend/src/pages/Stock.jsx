import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { ExpiryChip, StockChip } from "../components/Chips";
import RefillPanel from "../components/RefillPanel";
import { formatDate, isoDate } from "../util";

function StockEditor({ med, onSaved, onError }) {
  const [qty, setQty] = useState(med.quantity);
  const [busy, setBusy] = useState(false);
  useEffect(() => setQty(med.quantity), [med.quantity]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try { await api.medicines.setStock(med.id, Number(qty)); onSaved(); } catch (err) { onError(err.message); } finally { setBusy(false); }
  }
  return (
    <form className="inline-form" onSubmit={save}>
      <label className="sr-only" htmlFor={`q${med.id}`}>Quantity for {med.name}</label>
      <input id={`q${med.id}`} type="number" min="0" required value={qty} onChange={(e) => setQty(e.target.value)} />
      <button className="btn btn-ghost btn-sm" disabled={busy || Number(qty) === med.quantity}>Update</button>
    </form>
  );
}

function Group({ title, hint, items, kind, reload, onError }) {
  if (items.length === 0) return null;
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2><span className="muted">{hint}</span></div>
      <ul className="plain">
        {items.map((m) => (
          <li key={m.id}>
            <span>
              <strong>{m.name}</strong> <span className="muted">{m.dosage}</span>
              <small className="muted block">
                {kind === "expiry" ? (m.expiry_status === "expired" ? `Expired on ${formatDate(m.expiry_date)}` : `Expires on ${formatDate(m.expiry_date)}`) : `${m.quantity} left · alert at ${m.low_stock_threshold}`}
              </small>
            </span>
            <span className="row-actions">
              {kind === "expiry" ? <ExpiryChip med={m} /> : <StockChip med={m} />}
              {kind === "stock" && <StockEditor med={m} onSaved={reload} onError={onError} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Stock() {
  const [meds, setMeds] = useState(null);
  const [error, setError] = useState("");
  const [refills, setRefills] = useState([]);
  const load = useCallback(async () => {
    try {
      const [m, rf] = await Promise.all([api.medicines.list(isoDate()), api.medicines.refills(isoDate())]);
      setMeds(m); setRefills(rf); setError("");
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!meds) return error ? <ErrorNote onRetry={load}>{error}</ErrorNote> : <Spinner />;

  const lowStock = meds.filter((m) => m.stock_status !== "ok" && m.expiry_status !== "expired");
  const near = meds.filter((m) => m.expiry_status === "near");
  const expired = meds.filter((m) => m.expiry_status === "expired");

  return (
    <>
      <PageHeader title="Stock & expiry" subtitle="Know what is running out and what should be thrown away." />
      <ErrorNote>{error}</ErrorNote>

      {lowStock.length + near.length + expired.length === 0 && meds.length > 0 && (
        <Empty title="Everything is in stock and in date" />
      )}
      <section className="panel">
        <div className="panel-head"><h2>Refill forecast</h2><span className="muted">Based on your reminder schedule</span></div>
        <RefillPanel refills={refills} />
      </section>
      <Group title="Low or out of stock" hint="Update the count after a refill." items={lowStock} kind="stock" reload={load} onError={setError} />
      <Group title="Expiring soon" hint="Use these first or replace them." items={near} kind="expiry" reload={load} onError={setError} />
      <Group title="Expired" hint="Do not take these. Dispose of them safely." items={expired} kind="expiry" reload={load} onError={setError} />

      <section className="panel">
        <h2>All medicines</h2>
        {meds.length === 0 ? <Empty title="No medicines yet">Add medicines on the Medicines page.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Medicine</th><th>Stock</th><th>Expiry</th><th>Update quantity</th></tr></thead>
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong><small className="muted block">{m.dosage}</small></td>
                    <td className="chips"><span className="num-l">{m.quantity}</span><StockChip med={m} /></td>
                    <td className="chips">{formatDate(m.expiry_date)}<ExpiryChip med={m} /></td>
                    <td><StockEditor med={m} onSaved={load} onError={setError} /></td>
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
