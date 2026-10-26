import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consentStatus, setConsentStatus] = useState(null); // null=unknown, true=accepted, false=pending

  const fetchConsentStatus = useCallback(async (role) => {
    if (role !== "student") {
      setConsentStatus(true); // non-students bypass consent gate
      return;
    }
    try {
      const res = await api.get("/consent/status");
      setConsentStatus(res.data.accepted);
    } catch {
      setConsentStatus(false);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then(async (res) => {
        setUser(res.data);
        await fetchConsentStatus(res.data.role);
      })
      .catch(() => localStorage.removeItem("access_token"))
      .finally(() => setLoading(false));
  }, [fetchConsentStatus]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", res.data.access_token);
    const me = await api.get("/auth/me");
    setUser(me.data);
    await fetchConsentStatus(me.data.role);
    return me.data;
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setConsentStatus(null);
  };

  const updateConsentStatus = async () => {
    if (user) await fetchConsentStatus(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, consentStatus, login, logout, isAuthenticated: !!user, updateConsentStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
