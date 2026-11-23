import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Empty, ErrorNote, PageHeader, Spinner } from "../components/Feedback";
import { Chip } from "../components/Chips";
import ImportReview from "../components/ImportReview";
import { formatBytes, formatDateTime } from "../util";

const MAX_MB = 5;

export default function Prescriptions() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ title: "", doctor_name: "" });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try { setItems(await api.prescriptions.list()); setError(""); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(e) {
    e.preventDefault();
    setFormError("");
    if (!file) return setFormError("Choose a PDF or image file.");
    if (file.size > MAX_MB * 1024 * 1024) return setFormError(`File is larger than ${MAX_MB} MB.`);
    const fd = new FormData();
    fd.append("title", form.title.trim());
    if (form.doctor_name.trim()) fd.append("doctor_name", form.doctor_name.trim());
    fd.append("file", file);
    setBusy(true);
    try {
      const created = await api.prescriptions.upload(fd);
      setForm({ title: "", doctor_name: "" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
      if (created.content_type === "application/pdf") setImporting(created); // read it and offer to add its medicines
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function view(p) {
    const win = window.open("about:blank", "_blank"); // opened first so the popup blocker allows it
    try {
      const url = URL.createObjectURL(await api.prescriptions.file(p.id, false));
      if (win) win.location.href = url;
      else await download(p);
    } catch (e) {
      win?.close();
      setError(e.message);
    }
  }

  async function download(p) {
    try {
      const url = URL.createObjectURL(await api.prescriptions.file(p.id, true));
      const a = document.createElement("a");
      a.href = url;
      a.download = p.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.title}"? The uploaded file will be removed.`)) return;
    try { await api.prescriptions.remove(p.id); load(); } catch (e) { setError(e.message); }
  }

  return (
    <>
      <PageHeader title="Prescriptions" subtitle="Keep digital copies of your prescriptions. Only you can open them." />
      <ErrorNote onRetry={load}>{error}</ErrorNote>

      <div className="grid-2 wide-left">
        <section className="panel">
          <h2>Your prescriptions</h2>
          {!items ? <Spinner /> : items.length === 0 ? (
            <Empty title="No prescriptions uploaded">Upload a PDF or photo using the form. For PDFs with text, MediTrack can add the medicines and reminders for you.</Empty>
          ) : (
            <ul className="plain">
              {items.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.title}</strong>
                    <small className="muted block">
                      {p.doctor_name ? `Dr. ${p.doctor_name.replace(/^dr\.?\s*/i, "")} · ` : ""}
                      {p.original_filename} · {formatBytes(p.size_bytes)} · {formatDateTime(p.uploaded_at)}
                    </small>
                  </span>
                  <span className="row-actions">
                    <Chip>{p.content_type === "application/pdf" ? "PDF" : "Image"}</Chip>
                    {p.content_type === "application/pdf" && (
                      <button className="btn btn-primary btn-sm" onClick={() => setImporting(p)}>Add medicines</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => view(p)}>View</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => download(p)}>Download</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Upload a prescription</h2>
          <form onSubmit={upload} className="stack">
            <ErrorNote>{formError}</ErrorNote>
            <label className="field"><span>Title</span>
              <input required maxLength={150} placeholder="e.g. Cardiology follow-up" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="field"><span>Doctor (optional)</span>
              <input maxLength={150} value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} /></label>
            <label className="field"><span>File (PDF, PNG or JPG, up to {MAX_MB} MB)</span>
              <input ref={fileRef} type="file" required accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Upload prescription"}</button>
          </form>
        </section>
      </div>

      {importing && <ImportReview prescription={importing} onClose={() => setImporting(null)} />}
    </>
  );
}
