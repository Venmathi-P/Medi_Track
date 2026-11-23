import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { ExpiryChip, StockChip } from "../components/Chips";
import Modal from "../components/Modal";
import { formatDate, isoDate } from "../util";

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Every 8 hours", "Weekly", "As needed"];

const blank = () => ({
  name: "", dosage: "", frequency: "Once daily", quantity: 30, low_stock_threshold: 10,
  start_date: isoDate(), expiry_date: "", notes: "",
});

function MedicineForm({ initial, onSaved, onClose }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(initial ? { ...initial, notes: initial.notes ?? "" } : blank());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.expiry_date < form.start_date) return setError("Expiry date must be on or after the start date.");
    setBusy(true);
    setError("");
    const body = {
      name: form.name, dosage: form.dosage, frequency: form.frequency,
      quantity: Number(form.quantity), low_stock_threshold: Number(form.low_stock_threshold),
      start_date: form.start_date, expiry_date: form.expiry_date, notes: form.notes.trim() || null,
    };
    try {
      await (editing ? api.medicines.update(initial.id, body) : api.medicines.create(body));
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit medicine" : "Add medicine"} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <ErrorNote>{error}</ErrorNote>
        <label className="field"><span>Medicine name</span>
          <input required autoFocus maxLength={150} value={form.name} onChange={set("name")} /></label>
        <div className="row-2">
          <label className="field"><span>Dosage</span>
            <input required maxLength={100} placeholder="e.g. 500 mg" value={form.dosage} onChange={set("dosage")} /></label>
          <label className="field"><span>Frequency</span>
            <input required list="freqs" maxLength={100} value={form.frequency} onChange={set("frequency")} />
            <datalist id="freqs">{FREQUENCIES.map((f) => <option key={f} value={f} />)}</datalist></label>
        </div>
        <div className="row-2">
          <label className="field"><span>Quantity on hand</span>
            <input type="number" required min="0" value={form.quantity} onChange={set("quantity")} /></label>
          <label className="field"><span>Warn me when stock is at or below</span>
            <input type="number" required min="0" value={form.low_stock_threshold} onChange={set("low_stock_threshold")} /></label>
        </div>
        <div className="row-2">
          <label className="field"><span>Start date</span>
            <input type="date" required value={form.start_date} onChange={set("start_date")} /></label>
          <label className="field"><span>Expiry date</span>
            <input type="date" required min={form.start_date} value={form.expiry_date} onChange={set("expiry_date")} /></label>
        </div>
        <label className="field"><span>Notes (optional)</span>
          <textarea rows="2" maxLength={2000} placeholder="e.g. take after food" value={form.notes} onChange={set("notes")} /></label>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add medicine"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Medicines() {
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.medicines.list(isoDate(), query.trim()));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [query]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(m) {
    if (!window.confirm(`Delete ${m.name}? Its reminders and dose history will be deleted too.`)) return;
    try {
      await api.medicines.remove(m.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <PageHeader title="Medicines" subtitle="Everything you take, with dosage, stock and expiry.">
        <button className="btn btn-primary" onClick={() => setEditing({})}>Add medicine</button>
      </PageHeader>
      <ErrorNote onRetry={load}>{error}</ErrorNote>

      <div className="toolbar">
        <label className="field grow"><span className="sr-only">Search medicines</span>
          <input type="search" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <Empty title={query ? "No medicines match your search" : "No medicines yet"}>
          {query ? "Try a different name." : "Add your first medicine to start tracking doses and stock."}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th className="num">Quantity</th><th>Expiry</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong>{m.notes && <small className="muted block">{m.notes}</small>}</td>
                  <td>{m.dosage}</td>
                  <td>{m.frequency}</td>
                  <td className="num">{m.quantity}</td>
                  <td>{formatDate(m.expiry_date)}</td>
                  <td className="chips"><StockChip med={m} /><ExpiryChip med={m} /></td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MedicineForm initial={editing.id ? editing : null} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}
