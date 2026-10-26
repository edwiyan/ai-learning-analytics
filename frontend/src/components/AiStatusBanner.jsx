import { useEffect, useState } from "react";
import api from "../services/api";

// Shown to faculty when the LLM provider's circuit breaker is open (capstone §3.9.2
// graceful degradation): AI features fall back instead of failing silently.
export default function AiStatusBanner() {
  const [llm, setLlm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/health")
      .then(res => { if (!cancelled) setLlm(res.data?.llm ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!llm?.configured || llm.available) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <strong className="font-semibold">AI temporarily unavailable.</strong>{" "}
      New syllabi use the rule-based parser and new questions go to the manual review queue until the AI service recovers.
    </div>
  );
}
