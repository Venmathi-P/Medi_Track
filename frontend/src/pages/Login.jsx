import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ErrorNote } from "../components/Feedback";
import AuthShell from "./AuthShell";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.email.trim(), form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Pick up where you left off."
      footer={<>New to MediTrack? <Link to="/register">Create an account</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <ErrorNote>{error}</ErrorNote>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" autoFocus value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" required autoComplete="current-password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </AuthShell>
  );
}
