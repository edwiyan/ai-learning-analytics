import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, consentStatus } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Authenticated but wrong role → show a 403 page rather than bouncing to /login.
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  // Students must accept DPA 2012 consent before accessing any protected page
  if (user.role === "student" && location.pathname !== "/consent") {
    if (consentStatus === null) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>;
    if (consentStatus === false) return <Navigate to="/consent" replace />;
  }

  return children;
}
