import { useState, useEffect } from "react";
import Pagination from "../components/Pagination";
import Layout from "../components/Layout";
import RiskBadge from "../components/RiskBadge";
import { useApi } from "../hooks/useApi";
import api from "../services/api";

const INTERVENTION_TYPES = [
  { value: "academic_counseling",       label: "Academic Counseling" },
  { value: "tutoring_referral",         label: "Tutoring Referral" },
  { value: "study_skills_workshop",     label: "Study Skills Workshop" },
  { value: "peer_mentoring",            label: "Peer Mentoring" },
  { value: "modified_learning_strategy",label: "Modified Learning Strategy" },
  { value: "time_management_coaching",  label: "Time Management Coaching" },
  { value: "wellness_support_referral", label: "Wellness Support Referral" },
  { value: "general_note",              label: "General Note" },
];

const PAGE_SIZE = 10;

function ScorePill({ score }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const color =
    score >= 75 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  return <span className={`font-semibold ${color}`}>{score}%</span>;
}

function ConfidenceDot({ pct }) {
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-gray-300";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
      <span className="text-xs text-gray-500">{pct}%</span>
    </span>
  );
}

export default function InterventionAlertsPage() {
  const { data: alerts, loading, error } = useApi("/analytics/instructor/at-risk-students");
  const [courseFilter, setCourseFilter] = useState("All");
  const [reviewed, setReviewed] = useState(new Set());
  const [page, setPage] = useState(1);
  const [logOpen, setLogOpen] = useState(null); // { studentKey, courseId, student_id_hash }
  const [logType, setLogType] = useState("general_note");
  const [logNote, setLogNote] = useState("");
  const [logGoal, setLogGoal] = useState("");
  const [logTargetScore, setLogTargetScore] = useState("");
  const [logTargetPeriod, setLogTargetPeriod] = useState("");
  const [logFollowUp, setLogFollowUp] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [logSaved, setLogSaved] = useState(null);

  const openLog = (key, courseId, student_id_hash) => {
    setLogOpen({ key, courseId, student_id_hash });
    setLogType("general_note");
    setLogNote("");
    setLogGoal("");
    setLogTargetScore("");
    setLogTargetPeriod("");
    setLogFollowUp("");
    setLogSaved(null);
  };

  const submitLog = async () => {
    if (!logOpen) return;
    setLogSaving(true);
    try {
      await api.post(`/analytics/courses/${logOpen.courseId}/interventions`, {
        student_id_hash: logOpen.student_id_hash,
        action_type: "note",
        intervention_type: logType,
        note: logNote || null,
        goal_description: logGoal || null,
        target_score: logTargetScore ? parseFloat(logTargetScore) : null,
        target_period: logTargetPeriod || null,
        follow_up_date: logFollowUp || null,
      });
      setLogSaved(logOpen.key);
      setLogOpen(null);
      setReviewed(prev => { const n = new Set(prev); n.add(logOpen.key); return n; });
    } catch {
      // silent fail
    } finally {
      setLogSaving(false);
    }
  };

  useEffect(() => { setPage(1); }, [courseFilter, alerts]);

  const courses = alerts
    ? ["All", ...new Set(alerts.map(a => a.course_code))]
    : ["All"];

  const filtered = (alerts || []).filter(
    a => courseFilter === "All" || a.course_code === courseFilter
  );

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const unreviewedCount = filtered.filter(a => !reviewed.has(a.student_id_hash + a.course_id)).length;

  const toggleReviewed = (key) =>
    setReviewed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Intervention Alerts</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Students flagged as At-Risk across all your courses
            </p>
          </div>
          {!loading && alerts?.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {alerts.length} at-risk student{alerts.length !== 1 ? "s" : ""}
              </span>
              {reviewed.size > 0 && (
                <span className="text-xs text-gray-400">{reviewed.size} reviewed</span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            Loading alerts…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Failed to load alerts</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
              <p className="text-xs text-red-400 mt-1">Make sure the backend is running and try refreshing.</p>
            </div>
          </div>
        ) : !alerts?.length ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-700 font-semibold text-sm">No at-risk students</p>
            <p className="text-green-500 text-xs mt-1">All students are currently On-Track or Excelling.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total At-Risk", value: alerts.length, accent: "border-red-200 bg-red-50 text-red-700" },
                {
                  label: "Avg Score",
                  value: (() => {
                    const scored = alerts.filter(a => a.avg_score !== null);
                    return scored.length
                      ? Math.round(scored.reduce((s, a) => s + a.avg_score, 0) / scored.length) + "%"
                      : "—";
                  })(),
                  accent: "border-amber-200 bg-amber-50 text-amber-700",
                },
                {
                  label: "Courses Affected",
                  value: new Set(alerts.map(a => a.course_id)).size,
                  accent: "border-indigo-200 bg-indigo-50 text-indigo-700",
                },
                {
                  label: "Reviewed",
                  value: reviewed.size,
                  accent: "border-green-200 bg-green-50 text-green-700",
                },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.accent}`}>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-1">{c.label}</p>
                  <p className="text-2xl font-bold leading-none">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Course filter */}
            <div className="flex flex-wrap gap-2">
              {courses.map(c => (
                <button
                  key={c}
                  onClick={() => setCourseFilter(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    courseFilter === c
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {c === "All" ? `All Courses (${alerts.length})` : c}
                </button>
              ))}
            </div>

            {/* Alerts table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">At-Risk Students</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {unreviewedCount} need{unreviewedCount === 1 ? "s" : ""} review
                    {courseFilter !== "All" ? ` · ${courseFilter}` : ""}
                  </p>
                </div>
                {reviewed.size > 0 && (
                  <button
                    onClick={() => setReviewed(new Set())}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear reviewed
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                      <th className="px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Student</th>
                      <th className="px-5 py-3 text-left">Student No.</th>
                      <th className="px-5 py-3 text-left">Course</th>
                      <th className="px-5 py-3 text-right">Avg Score</th>
                      <th className="px-5 py-3 text-left">Weakest Area</th>
                      <th className="px-5 py-3 text-left">Weak Topics</th>
                      <th className="px-5 py-3 text-left">Confidence</th>
                      <th className="px-5 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paged.map((a, i) => {
                      const key = a.student_id_hash + a.course_id;
                      const isReviewed = reviewed.has(key);
                      const isLogging = logOpen?.key === key;
                      return (
                        <>
                          <tr
                            key={key}
                            className={`transition-colors ${
                              isReviewed
                                ? "bg-gray-50 opacity-60"
                                : "bg-red-50/20 hover:bg-red-50/40"
                            }`}
                          >
                            <td className="px-5 py-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + i + 1}</td>
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-800">{a.full_name}</p>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-gray-500">
                              {a.student_number || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5">
                                {a.course_code}
                              </span>
                              <span className="text-xs text-gray-500 hidden sm:inline">{a.course_title}</span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <ScorePill score={a.avg_score} />
                            </td>
                            <td className="px-5 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                              {a.weakest_topic || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                a.weak_count >= 3
                                  ? "bg-red-100 text-red-700"
                                  : a.weak_count >= 1
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}>
                                {a.weak_count} weak
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <ConfidenceDot pct={a.confidence} />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => isLogging ? setLogOpen(null) : openLog(key, a.course_id, a.student_id_hash)}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                    isLogging
                                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                      : logSaved === key
                                      ? "border-green-200 bg-green-50 text-green-700"
                                      : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                                  }`}
                                >
                                  {logSaved === key ? "✓ Logged" : isLogging ? "Cancel" : "Log"}
                                </button>
                                <button
                                  onClick={() => toggleReviewed(key)}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                    isReviewed
                                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                      : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                                  }`}
                                >
                                  {isReviewed ? "✓" : "Review"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isLogging && (
                            <tr key={key + "_log"} className="bg-indigo-50/60">
                              <td colSpan={9} className="px-5 py-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Intervention Type</label>
                                    <select
                                      value={logType}
                                      onChange={e => setLogType(e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                      {INTERVENTION_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</label>
                                    <input
                                      type="text"
                                      value={logNote}
                                      onChange={e => setLogNote(e.target.value)}
                                      placeholder="Add a note…"
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Improvement Goal (optional)</label>
                                    <input
                                      type="text"
                                      value={logGoal}
                                      onChange={e => setLogGoal(e.target.value)}
                                      placeholder="e.g. Raise competency score to 80% by midterm"
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Target Score (optional)</label>
                                    <input
                                      type="number" min="0" max="100"
                                      value={logTargetScore}
                                      onChange={e => setLogTargetScore(e.target.value)}
                                      placeholder="e.g. 80"
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Target Period (optional)</label>
                                    <select
                                      value={logTargetPeriod}
                                      onChange={e => setLogTargetPeriod(e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                      <option value="">— None —</option>
                                      <option value="prelim">Prelim</option>
                                      <option value="midterm">Midterm</option>
                                      <option value="semi_final">Semi-Final</option>
                                      <option value="final">Final</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Follow-up Date (optional)</label>
                                    <input
                                      type="date"
                                      value={logFollowUp}
                                      onChange={e => setLogFollowUp(e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      onClick={submitLog}
                                      disabled={logSaving}
                                      className="w-full px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                      {logSaving ? "Saving…" : "Save Intervention"}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
                <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700">
                Risk classification uses a rule-based engine with deterministic thresholds on competency mastery across grading periods.
                Students are flagged At-Risk when 3 or more competencies fall below the 75% passing threshold (learning gaps) or their average declines by more than 15% between grading periods.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
