import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { DEFAULT_THRESHOLDS, ThresholdsContext } from "./thresholds";

export function ThresholdsProvider({ children }) {
  const { user } = useAuth();
  const [values, setValues] = useState(DEFAULT_THRESHOLDS);

  const refresh = useCallback(() => {
    return api.get("/institution-settings/")
      .then(res => setValues({ ...DEFAULT_THRESHOLDS, ...res.data.values }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  return <ThresholdsContext.Provider value={{ ...values, refresh }}>{children}</ThresholdsContext.Provider>;
}
