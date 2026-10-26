import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../services/api";

const RISK = {
  "At-Risk": { bar: "bg-red-500", chip: "bg-red-50 text-red-700" },
  "On-Track": { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  Excelling: { bar: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
};
const BREAKDOWNS = ["Section", "Curriculum", "Program", "Year Level", "College", "Course"];
const EMPTY_FILTERS = { college: "", program: "", curriculum_id: "", section: "", course_id: "" };
const pct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);

function Kpi({ value, label, tone = "text-gray-800" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function RiskBar({ g }) {
  if (!g.total) return null;
  return (
    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100" title={`${g.at_risk} At-Risk · ${g.on_track} On-Track · ${g.excelling} Excelling`}>
      <div className={RISK["At-Risk"].bar} style={{ width: `${g.at_risk_pct}%` }} />
      <div className={RISK["On-Track"].bar} style={{ width: `${g.on_track_pct}%` }} />
      <div className={RISK.Excelling.bar} style={{ width: `${g.excelling_pct}%` }} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white min-w-0">
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function StudentTable({ rows, empty, needsIntervention = false }) {
  if (!rows.length) return <p className="text-sm text-gray-400 py-4 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-3 font-medium">Student</th>
            <th className="py-2 pr-3 font-medium">Section</th>
            <th className="py-2 pr-3 font-medium">Course</th>
            <th className="py-2 pr-3 font-medium text-right">Avg</th>
            <th className="py-2 pr-3 font-medium">Why</th>
            <th className="py-2 font-medium">Intervention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3"><p className="font-medium text-gray-800">{r.name}</p><p className="text-xs text-gray-400">{r.student_number}</p></td>
              <td className="py-2 pr-3 text-gray-600">{r.section}<p className="text-xs text-gray-400">{r.curriculum}</p></td>
              <td className="py-2 pr-3 text-gray-600">{r.course}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{pct(r.avg_score)}</td>
              <td className="py-2 pr-3 text-gray-600">{r.reason}{r.weak_topics?.length > 0 && <p className="text-xs text-gray-400">{r.weak_topics.slice(0, 2).join(" · ")}</p>}</td>
              <td className="py-2 text-gray-600 capitalize">{r.intervention || (needsIntervention ? <span className="text-red-600 normal-case">None logged</span> : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [options, setOptions] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState("Section");
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    api.get("/reports/options").then(r => setOptions(r.data)).catch(() => setOptions(null));
  }, []);

  const params = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    api.get("/reports/academic-performance", { params })
      .then(r => { if (!cancelled) { setReport(r.data); setError(""); } })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || "Could not load the report"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params]);

  const setFilter = (key, value) => { setLoading(true); setFilters(f => ({ ...f, [key]: value })); };

  const download = async (format) => {
    setDownloading(format);
    try {
      const res = await api.get("/reports/academic-performance/export", { params: { ...params, format }, responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || `AILAS_Report.${format}`;
      const href = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = href; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch {
      setError("The export failed. Please try again.");
    } finally { setDownloading(""); }
  };

  const s = report?.summary;
  const opt = (list) => (list || []).map(v => (typeof v === "string" ? { value: v, label: v } : { value: v.id, label: v.name }));

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Academic Performance and Early Intervention Report · <span className="font-medium text-indigo-600">{options?.scope || report?.scope || "…"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => download("pdf")} disabled={!!downloading || loading}
              className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {downloading === "pdf" ? "Preparing PDF…" : "⬇ Download PDF report"}
            </button>
            <button onClick={() => download("xlsx")} disabled={!!downloading || loading}
              className="px-4 py-2 text-sm font-semibold border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-50">
              {downloading === "xlsx" ? "Preparing Excel…" : "⬇ Excel workbook"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <Select label="College" value={filters.college} onChange={v => setFilter("college", v)} options={opt(options?.colleges)} />
          <Select label="Program" value={filters.program} onChange={v => setFilter("program", v)} options={opt(options?.programs)} />
          <Select label="Curriculum" value={filters.curriculum_id} onChange={v => setFilter("curriculum_id", v)} options={opt(options?.curricula)} />
          <Select label="Section" value={filters.section} onChange={v => setFilter("section", v)} options={opt(options?.sections)} />
          <Select label="Course" value={filters.course_id} onChange={v => setFilter("course_id", v)} options={opt(options?.courses)} />
          <button onClick={() => { setLoading(true); setFilters(EMPTY_FILTERS); }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg py-1.5">Reset filters</button>
        </div>

        {error && <div className="px-4 py-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{error}</div>}

        {loading && !report ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : s && (
          <div className={`space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Kpi value={s.students} label="Students assessed" />
              <Kpi value={s.total} label={`Course enrolments · ${s.courses} course${s.courses === 1 ? "" : "s"}`} />
              <Kpi value={s.at_risk} label={`At-Risk (${pct(s.at_risk_pct)})`} tone="text-red-600" />
              <Kpi value={s.on_track} label={`On-Track (${pct(s.on_track_pct)})`} tone="text-amber-600" />
              <Kpi value={s.excelling} label={`Excelling (${pct(s.excelling_pct)})`} tone="text-emerald-600" />
              <Kpi value={pct(s.avg_score)} label="Average score" tone="text-indigo-600" />
            </div>

            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-sm font-semibold text-gray-800">Risk distribution</h2>
                <div className="flex gap-1 flex-wrap">
                  {BREAKDOWNS.map(b => (
                    <button key={b} onClick={() => setBreakdown(b)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${breakdown === b ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                      By {b.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3 font-medium">{breakdown}</th>
                      <th className="py-2 pr-3 font-medium w-1/4">Mix</th>
                      <th className="py-2 pr-3 font-medium text-right">Enrolments</th>
                      <th className="py-2 pr-3 font-medium text-right">At-Risk</th>
                      <th className="py-2 pr-3 font-medium text-right">On-Track</th>
                      <th className="py-2 pr-3 font-medium text-right">Excelling</th>
                      <th className="py-2 font-medium text-right">Avg score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.breakdowns[breakdown] || []).map(g => (
                      <tr key={g.group} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-800">{g.group}</td>
                        <td className="py-2 pr-3"><RiskBar g={g} /></td>
                        <td className="py-2 pr-3 text-right tabular-nums">{g.total}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-red-600">{g.at_risk} <span className="text-xs text-gray-400">({pct(g.at_risk_pct)})</span></td>
                        <td className="py-2 pr-3 text-right tabular-nums">{g.on_track}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">{g.excelling}</td>
                        <td className="py-2 text-right tabular-nums">{pct(g.avg_score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid lg:grid-cols-3 gap-5">
              <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Most common learning gaps</h2>
                {report.competency_gaps.length ? (
                  <ul className="space-y-2">
                    {report.competency_gaps.slice(0, 8).map((g, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-indigo-600 w-24 shrink-0">{g.code}</span>
                        <span className="flex-1 min-w-0 truncate text-gray-700">{g.topic} <span className="text-xs text-gray-400">· {g.course}</span></span>
                        <span className="text-xs text-gray-500 shrink-0">{g.below}/{g.students} below 75%</span>
                        <span className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0"><span className="block h-full bg-red-400" style={{ width: `${g.below_pct}%` }} /></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400">No competency results yet.</p>}
              </section>
              <section className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-2">Intervention coverage</h2>
                <p className="text-3xl font-bold text-gray-800">{pct(report.interventions.coverage_pct)}</p>
                <p className="text-xs text-gray-500">of At-Risk enrolments have an intervention logged</p>
                <p className="text-sm mt-3 text-gray-700">{report.interventions.with_intervention} with a plan · <span className="text-red-600 font-medium">{report.interventions.without_intervention} awaiting follow-up</span></p>
              </section>
            </div>

            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">At-Risk students <span className="text-gray-400 font-normal">({report.at_risk.length})</span></h2>
              <StudentTable rows={report.at_risk} empty="No students are At-Risk in this scope." needsIntervention />
            </section>
            <section className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Excelling students <span className="text-gray-400 font-normal">({report.excelling.length})</span></h2>
              <StudentTable rows={report.excelling} empty="No students are Excelling in this scope." />
            </section>
            <p className="text-xs text-gray-400">The PDF adds per-section rosters for every curriculum, the full competency gap table and the methodology; the Excel workbook has every view as a filterable sheet. Both contain student information covered by RA 10173.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
