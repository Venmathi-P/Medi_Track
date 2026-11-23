import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { ErrorNote, PageHeader, Spinner } from "../components/Feedback";

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const BASE_KEY = "meditrack_public_base";
const toForm = (p) => ({
  is_enabled: p.is_enabled, blood_group: p.blood_group || "", allergies: p.allergies || "",
  conditions: p.conditions || "", contact_name: p.contact_name || "", contact_phone: p.contact_phone || "", notes: p.notes || "",
});

export default function EmergencyCard() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [base, setBase] = useState(localStorage.getItem(BASE_KEY) || window.location.origin);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.emergency.get();
      setSaved(p);
      setForm(toForm(p));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const link = saved ? `${base.trim().replace(/\/+$/, "")}/emergency/${saved.token}` : "";
  useEffect(() => {
    if (!saved?.is_enabled || !link) return setQr("");
    QRCode.toDataURL(link, { margin: 1, width: 260, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [saved, link]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      const p = await api.emergency.save(form);
      setSaved(p);
      setForm(toForm(p));
      setNote("Saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!window.confirm("Create a new link? The current link and any printed QR code will stop working.")) return;
    try {
      setSaved(await api.emergency.regenerate());
      setNote("New link created. Print or share the new QR code.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
    } catch {
      setNote("Could not copy automatically. Select the link and copy it.");
    }
  }

  if (!form) return error ? <ErrorNote onRetry={load}>{error}</ErrorNote> : <Spinner />;
  const localOnly = /localhost|127\.0\.0\.1/.test(base);

  return (
    <>
      <PageHeader title="Emergency card" subtitle="A QR code that shows your allergies, blood group and current medicines to a first responder." />
      <ErrorNote>{error}</ErrorNote>
      <div className="grid-2">
        <form className="panel stack no-print" onSubmit={save}>
          <h2>What to show</h2>
          <div className="row-2">
            <label className="field"><span>Blood group</span>
              <select value={form.blood_group} onChange={set("blood_group")}>
                <option value="">Not specified</option>
                {BLOOD.map((b) => <option key={b}>{b}</option>)}
              </select></label>
            <label className="field"><span>Emergency contact name</span>
              <input maxLength={100} value={form.contact_name} onChange={set("contact_name")} /></label>
          </div>
          <label className="field"><span>Emergency contact phone</span>
            <input type="tel" maxLength={30} pattern="[0-9+\-()\s]*" title="Digits, spaces, + - ( ) only" value={form.contact_phone} onChange={set("contact_phone")} /></label>
          <label className="field"><span>Allergies</span>
            <textarea rows="2" maxLength={1000} placeholder="e.g. Penicillin, peanuts" value={form.allergies} onChange={set("allergies")} /></label>
          <label className="field"><span>Medical conditions</span>
            <textarea rows="2" maxLength={1000} value={form.conditions} onChange={set("conditions")} /></label>
          <label className="field"><span>Other notes</span>
            <textarea rows="2" maxLength={1000} value={form.notes} onChange={set("notes")} /></label>
          <label className="switch">
            <input type="checkbox" checked={form.is_enabled} onChange={set("is_enabled")} />
            <span>Make the card viewable by anyone with the link or QR code</span>
          </label>
          <p className="muted small">
            Your current, unexpired medicines are included automatically. Your email is never shown. Turn this off to
            disable the link at any time.
          </p>
          <div className="actions-left">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            {note && <span className="muted" role="status">{note}</span>}
          </div>
        </form>

        <section className="panel wallet">
          <h2 className="no-print">Your QR card</h2>
          {saved.is_enabled && qr ? (
            <div className="wallet-card">
              <strong className="wallet-title">Emergency medical card</strong>
              <span className="wallet-name">{user.name}</span>
              <img src={qr} width="220" height="220" alt={`QR code that opens ${user.name}'s emergency medical card`} />
              <span className="wallet-note">Scan with a phone camera for allergies, blood group and current medicines.</span>
            </div>
          ) : (
            <p className="muted no-print">Turn on sharing and save to generate your QR code.</p>
          )}
          {saved.is_enabled && qr && (
            <div className="stack no-print">
              <div className="actions-left">
                <button className="btn btn-primary" onClick={() => window.print()}>Print card</button>
                <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">Preview</a>
                <button className="btn btn-ghost" onClick={copy}>Copy link</button>
              </div>
              <label className="field"><span>Address the QR code should open</span>
                <input value={base} onChange={(e) => { setBase(e.target.value); localStorage.setItem(BASE_KEY, e.target.value); }} /></label>
              {localOnly && (
                <p className="note note-warn">
                  A phone cannot open "localhost". Replace it with your computer's address on the same Wi-Fi, for example
                  http://192.168.1.5:5173 (run <code>ipconfig</code> and use the IPv4 Address). Allow Node.js through the Windows firewall if asked.
                </p>
              )}
              <button className="btn btn-danger btn-sm" onClick={regenerate}>Revoke and create a new link</button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
