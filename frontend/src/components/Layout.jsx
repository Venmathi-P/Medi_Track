import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";
import useDoseNotifications from "./useDoseNotifications";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/medicines", label: "Medicines" },
  { to: "/reminders", label: "Reminders" },
  { to: "/prescriptions", label: "Prescriptions" },
  { to: "/stock", label: "Stock & expiry" },
  { to: "/history", label: "History" },
  { to: "/report", label: "Doctor report" },
  { to: "/emergency-card", label: "Emergency card" },
];

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-pill" aria-hidden="true" />
      MediTrack
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  useDoseNotifications();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="who" title={user?.email}>{user?.name}</span>
          <button className="btn btn-ghost-light btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
