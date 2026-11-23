import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/Feedback";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import Reminders from "./pages/Reminders";
import Prescriptions from "./pages/Prescriptions";
import Stock from "./pages/Stock";
import History from "./pages/History";
import Report from "./pages/Report";
import EmergencyCard from "./pages/EmergencyCard";
import PublicEmergency from "./pages/PublicEmergency";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/emergency/:token" element={<PublicEmergency />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="stock" element={<Stock />} />
        <Route path="history" element={<History />} />
        <Route path="report" element={<Report />} />
        <Route path="emergency-card" element={<EmergencyCard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
