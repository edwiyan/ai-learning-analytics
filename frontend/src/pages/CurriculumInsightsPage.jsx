import { useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import Layout from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useThresholds } from "../hooks/useThresholds";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

function SectionCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>}
      {children}
    </div>
  );
}

function PipelineNode({ label, sub, color, icon }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 ${color}`}>
      <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-xs font-semibold text-center leading-tight">{label}</p>
      {sub && <p className="text-xs text-center opacity-70 leading-tight">{sub}</p>}
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="flex items-center shrink-0">
      <div className="h-0.5 w-6 bg-gray-300" />
      <svg className="w-3 h-3 text-gray-400 -ml-1" fill="currentColor" viewBox="0 0 12 12">
        <path d="M2 6l8-4v8L2 6z" />
      </svg>
    </div>
  );
}

function generateAISummary(subjects, yield_, trends) {
  if (!subjects?.length && !yield_) return null;
  const lines = [];
  if (yield_?.total > 0) {
    const passPct = Math.round(((yield_.proficient + yield_.developing) / yield_.total) * 100);
    lines.push(`${passPct}% of students are passing (Developing or above) across all courses.`);
    if (yield_.emerging > 0) {
      lines.push(`${yield_.emerging} student${yield_.emerging > 1 ? "s" : ""} are in the Emerging level and may need early intervention.`);
    }
  }
  if (subjects?.length) {
    const worst = subjects[0];
    const best = subjects[subjects.length - 1];
    if (worst.failure_rate > 0) {
      lines.push(`Highest failure rate: ${worst.course_code} (${worst.course_title}) at ${worst.failure_rate}% — recommend curriculum review.`);
    }
    if (best.avg_score) {
      lines.push(`Top performing subject: ${best.course_code} with an average score of ${best.avg_score}%.`);
    }
  }
  if (trends?.length > 1) {
    const last = trends[trends.length - 1];
    const prev = trends[trends.length - 2];
    if (last.avg_score && prev.avg_score) {
      const delta = (last.avg_score - prev.avg_score).toFixed(1);
      const dir = delta >= 0 ? "improved" : "declined";
      lines.push(`Overall performance has ${dir} by ${Math.abs(delta)}% from ${prev.period} to ${last.period}.`);
    }
  }
  return lines;
}

export default function CurriculumInsightsPage() {
  const T = useThresholds();
  const { data: subjects } = useApi("/analytics/admin/subject-performance");
  const { data: trends } = useApi("/analytics/admin/enrollment-trends");
  const { data: yield_ } = useApi("/analytics/admin/yield-distribution");
  const { data: auditLogs } = useApi("/analytics/admin/audit-logs?limit=20");

  const [program, setProgram] = useState("All");
  const [academicYear, setAcademicYear] = useState("All");
  const [semester, setSemester] = useState("All");

  const masteryData = trends?.length ? {
    labels: trends.map(t => t.period),
    datasets: [
      {
        label: "Current Mastery (%)",
        data: trends.map(t => t.avg_score),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.1)",
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: "#6366f1",
      },
      {
        label: `Target (${T.mastery_threshold}%)`,
        data: trends.map(() => T.mastery_threshold),
        borderColor: "rgba(156,163,175,0.7)",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
      },
    ],
  } : null;

  const yieldData = yield_?.total > 0 ? {
    labels: ["Proficient", "Developing", "Emerging"],
    datasets: [{
      data: [yield_.proficient, yield_.developing, yield_.emerging],
      backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
      borderWidth: 0,
    }],
  } : null;

  const aiSummary = generateAISummary(subjects, yield_, trends);
  const topSubjects = subjects ? [...subjects].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0)).slice(0, 5) : [];
  const needsReview = subjects ? subjects.filter(s => s.failure_rate > 25) : [];
  const recentReports = (auditLogs || []).filter(l =>
    ["upload_csv", "upload_syllabus", "validate_syllabus", "bulk_import_students"].includes(l.action)
  ).slice(0, 6);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Curriculum Insights</h1>
            <p className="text-sm text-gray-500 mt-0.5">Mastery reports, subject performance, and AI pipeline analysis</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["Program", program, setProgram, ["All", "BSIT", "BSCS", "BSA", "BSBA", "BEEd", "BSEd"]],
              ["Academic Year", academicYear, setAcademicYear, ["All", "2023-2024", "2024-2025", "2025-2026"]],
              ["Semester", semester, setSemester, ["All", "1st Sem", "2nd Sem", "Summer"]],
            ].map(([label, val, setter, opts]) => (
              <select
                key={label}
                value={val}
                onChange={e => setter(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* Curriculum Mastery + Yield */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <SectionCard title="Curriculum Mastery Report">
              {masteryData ? (
                <div className="relative h-60">
                  <Line
                    data={masteryData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { font: { size: 11 }, boxWidth: 12, padding: 10 },
                        },
                      },
                      scales: {
                        y: {
                          min: 0, max: 100,
                          ticks: { callback: v => `${v}%`, font: { size: 10 } },
                          grid: { color: "rgba(0,0,0,0.04)" },
                        },
                        x: { ticks: { font: { size: 10 } } },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-60 text-gray-300 text-sm">No data yet</div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Enrollment Yield">
            {yieldData ? (
              <>
                <div className="flex items-center justify-center h-44">
                  <Doughnut
                    data={yieldData}
                    options={{
                      cutout: "60%",
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { font: { size: 10 }, boxWidth: 10, padding: 6 },
                        },
                      },
                    }}
                  />
                </div>
                <p className="text-xs text-center text-gray-400 mt-1">{yield_.total} total students</p>
              </>
            ) : (
              <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No data yet</div>
            )}
          </SectionCard>
        </div>

        {/* AI Summary */}
        {aiSummary?.length > 0 && (
          <SectionCard>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.001 3.001 0 0012 15a3 3 0 00-2.971 2.589l-.347-.346z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">AI Summary</p>
                <ul className="space-y-1">
                  {aiSummary.map((line, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                      <span className="text-indigo-400 mt-1 shrink-0">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Subject tables + Recent Reports */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard title="Top Performing Subjects">
            {topSubjects.length ? (
              <div className="space-y-2">
                {topSubjects.map((s, i) => (
                  <div key={s.course_id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-indigo-600">{s.course_code}</p>
                      <p className="text-xs text-gray-600 truncate">{s.course_title}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600 shrink-0">{s.avg_score}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No data yet</p>
            )}
          </SectionCard>

          <SectionCard title="Subjects Requiring Review">
            {needsReview.length ? (
              <div className="space-y-2">
                {needsReview.slice(0, 5).map(s => (
                  <div key={s.course_id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-red-500">{s.course_code}</p>
                      <p className="text-xs text-gray-600 truncate">{s.course_title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-600">{s.failure_rate}%</p>
                      <p className="text-xs text-gray-400">fail rate</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No subjects above 25% failure rate.</p>
            )}
          </SectionCard>

          <SectionCard title="Recent Reports">
            {recentReports.length ? (
              <div className="space-y-2">
                {recentReports.map(log => (
                  <div key={log.id} className="flex items-start gap-2 py-1 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 capitalize">{log.action.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-400 truncate">{log.actor_name || "—"}</p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleDateString() : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No recent activity yet.</p>
            )}
          </SectionCard>
        </div>

        {/* AI Logic Visualization */}
        <SectionCard title="AI Logic Visualization">
          <p className="text-xs text-gray-400 mb-5">How AILAS processes data from ingestion to insights</p>
          <div className="flex items-center justify-start sm:justify-center flex-nowrap gap-1 overflow-x-auto py-2 -mx-2 px-2">
            <PipelineNode label="Data Ingestion" sub="PDF · DOCX · CSV" color="border-blue-200 bg-blue-50 text-blue-800" icon="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            <PipelineArrow />
            <PipelineNode label="OCR Extraction" sub="Tesseract" color="border-amber-200 bg-amber-50 text-amber-800" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <PipelineArrow />
            <PipelineNode label="AI Logic Core" sub="GPT-4o-mini · LLM API" color="border-indigo-200 bg-indigo-50 text-indigo-800" icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.001 3.001 0 0012 15a3 3 0 00-2.971 2.589l-.347-.346z" />
            <PipelineArrow />
            <PipelineNode label="Risk Classification" sub="Rule-Based Engine" color="border-red-200 bg-red-50 text-red-800" icon="M13 10V3L4 14h7v7l9-11h-7z" />
            <PipelineArrow />
            <PipelineNode label="Recommendations" sub="Tag-Match" color="border-green-200 bg-green-50 text-green-800" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            <PipelineArrow />
            <PipelineNode label="Actionable Insights" sub="Dashboards · Alerts" color="border-purple-200 bg-purple-50 text-purple-800" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
            {[
              { label: "Topic Classification Logic", desc: `GPT-4o-mini receives question text and syllabus topics and returns the best-matching topic with a self-reported confidence score. Confidence only orders the review queue: ${T.mapping_auto_accept ? "items" : "every mapping is confirmed by faculty; items"} below ${Math.round(T.mapping_review_threshold * 100)}% are reviewed first.` },
              { label: "Risk Classification Rules", desc: "Rule-Based Engine applies deterministic thresholds on competency mastery and period-over-period grade decline. Outputs At-Risk · On-Track · Excelling." },
              { label: "Recommendation Engine", desc: "Tag-Match Recommender queries resources whose competency tags overlap with the student's weak competency codes and topic names, ranked by match count." },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">{item.label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </Layout>
  );
}
