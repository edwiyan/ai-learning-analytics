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
    let cancelled = false;  // ignore a slower response for a URL we already moved away from
    api.get(url)
      .then(res => { if (!cancelled) { setData(res.data); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || "Request failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // `url` is a dependency too: a caller whose URL embeds an id (course, assessment)
  // must refetch when that id changes even if it passes no explicit deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps, tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { data, loading, error, refetch };
}
