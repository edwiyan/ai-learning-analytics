import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

export function useApi(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    api.get(url)
      .then(res => { setData(res.data); setError(null); })
      .catch(err => setError(err.response?.data?.detail || "Request failed"))
      .finally(() => setLoading(false));
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { data, loading, error, refetch };
}
