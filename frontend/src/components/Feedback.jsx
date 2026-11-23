export function Spinner({ full }) {
  return (
    <div className={full ? "center-screen" : "center-block"} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> <span className="muted">Loading…</span>
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  if (!children) return null;
  return (
    <div className="note note-error" role="alert">
      <span>{children}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
