import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useThresholds } from "../hooks/useThresholds";

const GROUPS = [
  { title: "At-risk classification", note: "Institutionally defined operational thresholds. Changing them recomputes every course's risk classification.",
    keys: ["mastery_threshold", "at_risk_min_gaps", "grade_decline_pct", "excelling_avg", "proficient_threshold"] },
  { title: "AI competency mapping", note: "The AI's confidence is self-reported. Keep auto-accept off until the mapping validation shows the confident band meets the accuracy target.",
    keys: ["mapping_review_threshold", "mapping_auto_accept"] },
  { title: "Early warning", note: "Used to measure whether alerts and interventions are early.",
    keys: ["early_warning_period", "intervention_target_school_days"] },
];
const PERIOD_LABELS = { prelim: "Prelim", midterm: "Midterm", semi_final: "Semi-Final", final: "Final" };

function Field({ k, spec, value, onChange, readOnly }) {
  const common = "border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 disabled:bg-gray-50 disabled:text-gray-600";
  let input;
  if (k === "mapping_auto_accept") {
    input = (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} disabled={readOnly} onChange={e => onChange(e.target.checked)} className="rounded" />
        {value ? "On" : "Off"}
      </label>
    );
  } else if (k === "early_warning_period") {
    input = (
      <select value={value} disabled={readOnly} onChange={e => onChange(e.target.value)} className={common}>
        {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  } else {
    const step = k === "mapping_review_threshold" ? 0.05 : ["at_risk_min_gaps", "intervention_target_school_days"].includes(k) ? 1 : 0.5;
    input = <input type="number" value={value} step={step} min={spec.min ?? undefined} max={spec.max ?? undefined}
      disabled={readOnly} onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={common} />;
  }
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{spec.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{spec.description}</p>
      </div>
      <div className="shrink-0">{input}</div>
    </div>
  );
}

function SensitivityTable() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/institution-settings/sensitivity")
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || "Could not compute the sensitivity table"));
  }, []);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-400">Computing…</p>;
  const isCurrent = (row, d) => row.mastery_threshold === data.current.mastery_threshold
    && row.min_gaps === data.current.min_gaps && Number(d) === data.current.grade_decline_pct;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Course enrolments flagged At-Risk under alternative thresholds ({data.enrolments} enrolments · {data.scope}). The highlighted cell is the current setting.
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-xs text-gray-500 text-left">
              <th className="py-2 pr-4 font-medium">Mastery threshold</th>
              <th className="py-2 pr-4 font-medium">Learning gaps</th>
              {data.decline_options.map(d => <th key={d} className="py-2 px-3 font-medium text-right">Decline &gt; {Number(d)}%</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1.5 pr-4">{row.mastery_threshold}%</td>
                <td className="py-1.5 pr-4">≥ {row.min_gaps}</td>
                {data.decline_options.map(d => (
                  <td key={d} className={`py-1.5 px-3 text-right tabular-nums ${isCurrent(row, d) ? "bg-indigo-100 font-semibold text-indigo-800 rounded" : ""}`}>
                    {row.flagged[d]}
                    {data.enrolments > 0 && <span className="text-xs text-gray-400"> ({Math.round(row.flagged[d] / data.enrolments * 100)}%)</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InstitutionSettingsPage() {
  const { user } = useAuth();
  const { refresh } = useThresholds();
  const readOnly = user?.role !== "admin";
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get("/institution-settings/").then(r => { setData(r.data); setForm(r.data.values); }).catch(() => {});
  }, []);

  const changed = data ? Object.keys(form).filter(k => form[k] !== data.values[k]) : [];

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const body = Object.fromEntries(changed.map(k => [k, form[k]]));
      const res = await api.put("/institution-settings/", body);
      setData(res.data); setForm(res.data.values);
      refresh();
      setMessage({ type: "ok", text: res.data.recomputing
        ? "Saved. Risk classifications are being recomputed for every course."
        : "Saved." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Could not save the settings." });
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Institution Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational thresholds validated by BTECH's academic administrators.
            {data?.updated_at
              ? ` Last changed ${new Date(data.updated_at).toLocaleString()}${data.updated_by ? ` by ${data.updated_by}` : ""}.`
              : " Using the system defaults (not yet changed)."}
            {readOnly && " Only administrators can change them."}
          </p>
        </div>

        {message && (
          <div className={`px-4 py-2.5 rounded-lg text-sm border ${message.type === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{message.text}</div>
        )}

        {data && GROUPS.map(g => (
          <section key={g.title} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-800">{g.title}</h2>
            <p className="text-xs text-gray-500 mb-1">{g.note}</p>
            {g.keys.map(k => (
              <Field key={k} k={k} spec={data.spec[k]} value={form[k]} readOnly={readOnly}
                onChange={v => setForm(f => ({ ...f, [k]: v }))} />
            ))}
          </section>
        ))}

        {!readOnly && data && (
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving || changed.length === 0}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes"}
            </button>
            {changed.length > 0 && (
              <button onClick={() => setForm(data.values)} className="text-sm text-gray-500 hover:underline">Discard</button>
            )}
            <span className="text-xs text-gray-400">Every change is recorded in the audit log.</span>
          </div>
        )}

        <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Threshold sensitivity</h2>
          <SensitivityTable />
        </section>
      </div>
    </Layout>
  );
}
