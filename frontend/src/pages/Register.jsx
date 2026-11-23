import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ErrorNote } from "../components/Feedback";
import AuthShell from "./AuthShell";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your medicine records stay private to you."
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <ErrorNote>{error}</ErrorNote>
        <label className="field">
          <span>Full name</span>
          <input required minLength={2} autoComplete="name" autoFocus value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <small className="muted">At least 8 characters.</small>
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}
