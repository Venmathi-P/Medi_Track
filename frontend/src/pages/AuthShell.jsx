import { Logo } from "../components/Layout";

// A blister pack: the brand motif. Filled pills are "taken" doses.
const TAKEN = [0, 1, 2, 3, 4, 6, 7, 8];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <Logo />
        <div>
          <div className="blister">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className={TAKEN.includes(i) ? "cell taken" : "cell"} />
            ))}
          </div>
          <p className="auth-line">Every dose, every refill, every prescription in one place.</p>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          <p className="auth-foot">{footer}</p>
        </div>
      </section>
    </div>
  );
}
