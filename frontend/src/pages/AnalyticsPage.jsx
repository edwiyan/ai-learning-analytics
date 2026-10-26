import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 10;

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const ACTION_LABELS = {
  login: "Logged in",
  create_user: "Created user",
  deactivate_user: "Deactivated user",
  bulk_import_students: "Bulk imported students",
  upload_syllabus: "Uploaded syllabus",
  validate_syllabus: "Validated syllabus",
  upload_csv: "Uploaded assessment CSV",
};

const ACTION_COLORS = {
  login: "bg-gray-100 text-gray-600",
  create_user: "bg-indigo-100 text-indigo-700",
  deactivate_user: "bg-red-100 text-red-700",
  bulk_import_students: "bg-blue-100 text-blue-700",
  upload_syllabus: "bg-amber-100 text-amber-700",
  validate_syllabus: "bg-green-100 text-green-700",
  upload_csv: "bg-purple-100 text-purple-700",
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SectionCard({ title, badge, action, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 ${className}`}>
      {(title || badge || action) && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            {title && <h2 className="text-base font-semibold text-gray-700">{title}</h2>}
            {badge}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function StudentRow({ student }) {
  const gradeColor =
    student.avg_score === null ? "text-gray-400"
    : student.avg_score >= 90 ? "text-blue-600"
    : student.avg_score >= 75 ? "text-green-600"
    : "text-red-600";

  return (
    <tr className="hover:bg-gray-50">
      <td className="py-2.5 pr-4">
        <p className="text-sm font-medium text-gray-800">{student.full_name}</p>
        {student.student_number && (
          <p className="text-xs text-gray-400">{student.student_number}</p>
        )}
      </td>
      <td className="py-2.5 pr-4">
        <span className={`text-sm font-bold ${gradeColor}`}>
          {student.avg_score !== null ? `${student.avg_score}%` : "—"}
        </span>
      </td>
      <td className="py-2.5 pr-4 hidden md:table-cell">
        <span className="text-sm text-gray-600 truncate max-w-[160px] block">
          {student.weakest_topic || "—"}
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <RiskBadge level={student.risk_level} />
      </td>
    </tr>
  );
}

// ── CSV export helpers ────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCompetenciesCSV(tmItems, courseCode) {
  const headers = ["Competency Code", "Topic Name", "Class Avg (%)", "0–59% (students)", "60–74%", "75–89%", "90–100%", "Total Students"];
  const rows = tmItems.map(d => [d.competency_code, d.topic_name, d.class_avg, d.b0_60, d.b60_75, d.b75_90, d.b90_100, d.total_students]);
  downloadCSV([headers, ...rows], `${courseCode || "course"}_competency_mastery.csv`);
}

function exportRiskTrendCSV(ewWeeks, courseCode) {
  const headers = ["Period/Week", "At-Risk", "On-Track", "Excelling", "Total"];
  const rows = ewWeeks.map(w => [w.week_label, w.at_risk, w.on_track, w.excelling, w.total]);
  downloadCSV([headers, ...rows], `${courseCode || "course"}_risk_trend.csv`);
}

// ── Instructor analytics sub-components ──────────────────────────────────────

function RiskFilterPills({ value, onChange }) {
  const pills = [
    { label: "All",       key: "all" },
    { label: "At-Risk",   key: "At-Risk" },
    { label: "On-Track",  key: "On-Track" },
    { label: "Excelling", key: "Excelling" },
  ];
  function activeClass(key) {
    if (value !== key) return "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300";
    if (key === "At-Risk")   return "bg-red-600 text-white";
    if (key === "On-Track")  return "bg-green-600 text-white";
    if (key === "Excelling") return "bg-blue-600 text-white";
    return "bg-indigo-600 text-white";
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map(({ label, key }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${activeClass(key)}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StudentSearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
      </svg>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Search students…"
        className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
      {value && (
        <button onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          aria-label="Clear search">×</button>
      )}
    </div>
  );
}

// ── Instructor view ───────────────────────────────────────────────────────────

function InstructorAnalytics() {
  const { data: courses, loading } = useApi("/courses/");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [page, setPage] = useState(1);

  const courseId = selectedCourse?.id;

  // ── Overview ──────────────────────────────────────────────────────────────
  const { data: overview } = useApi(courseId ? `/analytics/courses/${courseId}/overview` : null, [courseId]);
  const atRiskCount = overview?.at_risk ?? 0;

  // ── Topic Mastery Distribution (stacked histogram) ────────────────────────
  const { data: tmData, loading: tmLoading } = useApi(
    courseId ? `/analytics/courses/${courseId}/topic-mastery-distribution` : null, [courseId]
  );
  const tmItems = tmData ?? [];

  const tmChartData = tmItems.length ? {
    labels: tmItems.map(d => d.competency_code),
    datasets: [
      { label: "0–59%",   data: tmItems.map(d => d.b0_60),   backgroundColor: "rgba(239,68,68,0.8)",  stack: "s" },
      { label: "60–74%",  data: tmItems.map(d => d.b60_75),  backgroundColor: "rgba(251,191,36,0.8)", stack: "s" },
      { label: "75–89%",  data: tmItems.map(d => d.b75_90),  backgroundColor: "rgba(34,197,94,0.8)",  stack: "s" },
      { label: "90–100%", data: tmItems.map(d => d.b90_100), backgroundColor: "rgba(59,130,246,0.8)", stack: "s" },
    ],
  } : null;

  // ── Early Warning Timeline (weekly) ───────────────────────────────────────
  const { data: ewData, loading: ewLoading } = useApi(
    courseId ? `/analytics/courses/${courseId}/early-warning-timeline` : null, [courseId]
  );
  const ewWeeks = ewData ?? [];

  const ewChartData = ewWeeks.length ? {
    labels: ewWeeks.map(w => w.week_label),
    datasets: [
      { label: "At-Risk",   data: ewWeeks.map(w => w.at_risk),   borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)",  fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2 },
      { label: "On-Track",  data: ewWeeks.map(w => w.on_track),  borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.08)", fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2 },
      { label: "Excelling", data: ewWeeks.map(w => w.excelling), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.08)",fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, borderWidth: 2 },
    ],
  } : null;

  const ewHasAlert = ewWeeks.some(w => (w.at_risk ?? 0) > (w.on_track ?? 0) + (w.excelling ?? 0));

  // ── Student Performance (server-side filter + sort + pagination) ──────────
  const [spSort, setSpSort]           = useState({ key: "avg_score", dir: "asc" });
  const [spRiskFilter, setSpRiskFilter] = useState("all");
  const [spSearch, setSpSearch]         = useState("");
  const SP_PAGE_SIZE = 10;

  useEffect(() => { setPage(1); }, [courseId, spSort, spRiskFilter, spSearch]);

  const spUrl = courseId
    ? `/analytics/courses/${courseId}/students?sort_by=${spSort.key}&sort_order=${spSort.dir}&risk_filter=${encodeURIComponent(spRiskFilter)}&search=${encodeURIComponent(spSearch)}&skip=${(page - 1) * SP_PAGE_SIZE}&limit=${SP_PAGE_SIZE}`
    : null;
  const { data: spData, loading: loadingStudents } = useApi(spUrl, [spUrl]);
  const students   = spData?.data  ?? [];
  const spTotal    = spData?.total ?? 0;
  const spTotalPages = Math.max(1, Math.ceil(spTotal / SP_PAGE_SIZE));

  const handleSpSort = useCallback((key) => {
    setSpSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" }
    );
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Course selector */}
      {courses?.length > 0 && (
        <select
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          value={selectedCourse?.id || ""}
          onChange={e => setSelectedCourse(courses.find(c => c.id === e.target.value) || null)}
        >
          <option value="">Select a course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
      )}

      {!courseId && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-8 text-center">
          <svg className="w-10 h-10 text-indigo-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-indigo-700 font-medium text-sm">
            {courses?.length === 0 ? "No courses yet. Go to Ingestion Module to create one." : "Select a course above to view analytics."}
          </p>
        </div>
      )}

      {courseId && overview && (
        <>
          {/* Overview stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Students" value={overview.total_students} color="indigo" />
            <StatCard label="At-Risk"   value={overview.at_risk}   color="red"   sub="below 75% overall" />
            <StatCard label="On-Track"  value={overview.on_track}  color="green" sub="75–89%" />
            <StatCard label="Excelling" value={overview.excelling} color="blue"  sub="90%+" />
          </div>

          {/* Topic Mastery Distribution — stacked horizontal bar (histogram bins) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard
              title="Topic Mastery Distribution"
              badge={<span className="text-xs text-gray-400">Students per score band</span>}
              action={tmItems.length ? (
                <button onClick={() => exportCompetenciesCSV(tmItems, selectedCourse?.code)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  CSV
                </button>
              ) : null}
            >
              {tmLoading ? (
                <ChartSkeleton height="h-56" />
              ) : tmChartData ? (
                <>
                  <div className="relative h-56">
                    <Bar
                      data={tmChartData}
                      options={{
                        indexAxis: "y",
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } },
                          tooltip: { callbacks: { label: item => `${item.dataset.label}: ${item.raw} students` } },
                        },
                        scales: {
                          x: { stacked: true, ticks: { font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" } },
                          y: { stacked: true, ticks: { font: { size: 10 } }, grid: { display: false } },
                        },
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Sorted weakest competency first</p>
                </>
              ) : (
                <div className="flex items-center justify-center h-56 text-gray-300 text-sm">No competency data yet</div>
              )}
            </SectionCard>

            {/* Early Warning System — weekly multi-line trend */}
            <SectionCard
              title="Early Warning System"
              action={ewWeeks.length ? (
                <button onClick={() => exportRiskTrendCSV(ewWeeks, selectedCourse?.code)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  CSV
                </button>
              ) : null}
            >
              {ewHasAlert && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs text-amber-700">⚠ Rising at-risk trend detected. Review affected students below.</p>
                </div>
              )}
              {ewLoading ? (
                <ChartSkeleton height="h-48" />
              ) : ewChartData ? (
                <>
                  <div className="relative h-48">
                    <Line
                      data={ewChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } },
                          tooltip: { callbacks: { label: item => `${item.dataset.label}: ${item.raw}` } },
                        },
                        scales: {
                          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, callback: v => Number.isInteger(v) ? v : "" }, grid: { color: "rgba(0,0,0,0.04)" } },
                          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
                        },
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    At-Risk: 3+ learning gaps or &gt;15% grade decline · Excelling: ≥85% mastery, no gaps · On-Track: otherwise
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No timeline data yet</div>
              )}
            </SectionCard>
          </div>

          {/* Student Performance — filtered, sorted, server-side paginated */}
          <SectionCard
            title="Student Performance"
            badge={atRiskCount > 0 ? (
              <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {atRiskCount} at-risk
              </span>
            ) : null}
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{spTotal} student{spTotal !== 1 ? "s" : ""}</span>
                <a
                  href={`/api/analytics/courses/${courseId}/export/students`}
                  download
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export All CSV
                </a>
              </div>
            }
          >
            {/* Filter row */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1">
                <StudentSearchBar value={spSearch} onChange={setSpSearch} />
              </div>
              <RiskFilterPills value={spRiskFilter} onChange={setSpRiskFilter} />
            </div>

            {/* Sort row */}
            <div className="flex items-center gap-3 mb-2 text-xs text-gray-400">
              <span>Sort by:</span>
              {[
                { key: "avg_score",  label: "Score"      },
                { key: "risk_level", label: "Risk"        },
                { key: "weak_count", label: "Weak Topics" },
                { key: "full_name",  label: "Name"        },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => handleSpSort(key)}
                  className={`flex items-center gap-0.5 hover:text-gray-600 transition-colors ${spSort.key === key ? "text-indigo-600 font-semibold" : ""}`}>
                  {label}
                  {spSort.key === key && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={spSort.dir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {loadingStudents ? (
              <div className="text-gray-400 text-sm py-4">Loading student data...</div>
            ) : students.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="pb-2 font-medium">Student</th>
                      <th className="pb-2 font-medium">Current Grade</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Weakest Topic</th>
                      <th className="pb-2 font-medium">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map(s => (
                      <StudentRow key={s.student_id_hash} student={s} />
                    ))}
                  </tbody>
                </table>
                <Pagination page={page} total={spTotal} pageSize={SP_PAGE_SIZE} onChange={setPage} />
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">No students match your filters.</p>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ── Pipeline helpers ──────────────────────────────────────────────────────────

function PipelineNode({ label, sub, color, icon, tooltip }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const nodeRef = useRef(null);

  const handleMouseEnter = () => {
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setHovered(true);
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={`relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 cursor-default select-none transition-all duration-150 ${color} ${hovered ? "shadow-md scale-[1.03]" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <p className="text-xs font-semibold text-center leading-tight">{label}</p>
        {sub && <p className="text-xs text-center opacity-70 leading-tight">{sub}</p>}
      </div>
      {tooltip && hovered && createPortal(
        <div
          className="fixed z-[9999] bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg pointer-events-none"
          style={{ left: pos.x, top: pos.y - 8, transform: "translate(-50%, -100%)" }}
        >
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800" />
        </div>,
        document.body
      )}
    </>
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

// ── Admin skeleton loaders ────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
      <div className="h-7 w-12 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-24 bg-gray-100 rounded mb-1.5" />
      <div className="h-2.5 w-16 bg-gray-100 rounded" />
    </div>
  );
}

function ChartSkeleton({ height = "h-64" }) {
  const bars = [45, 70, 55, 85, 60, 40, 75, 50];
  return (
    <div className={`${height} flex items-end gap-1.5 animate-pulse`}>
      {bars.map((h, i) => (
        <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function DonutSkeleton() {
  return (
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <div className="w-full h-full rounded-full bg-gray-100" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white" />
        </div>
      </div>
      <div className="space-y-2 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 h-3 bg-gray-100 rounded" />
            <div className="w-5 h-3 bg-gray-200 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2">
          <div className="w-16 h-3 bg-gray-200 rounded" />
          <div className="w-32 h-3 bg-gray-100 rounded" />
        </div>
      </td>
      <td className="py-2.5 pr-4 text-center">
        <div className="h-5 w-14 bg-gray-100 rounded-full mx-auto" />
      </td>
      <td className="py-2.5 pr-4 text-center">
        <div className="h-5 w-14 bg-gray-100 rounded-full mx-auto" />
      </td>
      <td className="py-2.5 text-center">
        <div className="h-3 w-8 bg-gray-100 rounded mx-auto" />
      </td>
    </tr>
  );
}

// ── Admin KPI card ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, colorClass }) {
  return (
    <div className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow duration-200 p-4 flex flex-col gap-1 ${colorClass}`}>
      <p className="text-2xl font-bold leading-none">{value ?? "—"}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminAnalytics() {
  const { data: trends,   loading: loadingTrends }   = useApi("/analytics/admin/enrollment-trends");
  const { data: yield_,   loading: loadingYield }    = useApi("/analytics/admin/yield-distribution");
  const { data: subjects, loading: loadingSubjects } = useApi("/analytics/admin/subject-performance");
  const { data: stats,    loading: loadingStats }    = useApi("/analytics/admin/stats");

  const masteryRef = useRef(null);
  const yieldRef   = useRef(null);

  // ── KPI computations ──────────────────────────────────────────────────────────
  const lastTrend = trends?.[trends.length - 1];
  const prevTrend = trends?.[trends.length - 2];

  const masteryGap = lastTrend?.avg_score != null
    ? parseFloat((lastTrend.avg_score - 75).toFixed(1))
    : null;

  const enrollmentChange = (lastTrend && prevTrend)
    ? lastTrend.student_count - prevTrend.student_count
    : null;

  const atRiskCount = yield_
    ? (yield_.emerging || 0)
    : null;

  const overallFailureRate = subjects?.length
    ? parseFloat((subjects.reduce((s, c) => s + (c.failure_rate || 0), 0) / subjects.length).toFixed(1))
    : null;

  // ── Chart export helper ───────────────────────────────────────────────────────
  function exportChart(ref, filename) {
    const chart = ref.current;
    if (!chart) return;
    const url = chart.toBase64Image("image/png", 1);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  }

  function ExportBtn({ chartRef, filename }) {
    return (
      <button
        onClick={() => exportChart(chartRef, filename)}
        title="Export as PNG"
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    );
  }

  // ── Chart datasets ────────────────────────────────────────────────────────────

  const masteryData = trends?.length ? {
    labels: trends.map(t => t.period),
    datasets: [
      {
        label: "Current Mastery (%)",
        data: trends.map(t => t.avg_score),
        borderColor: "#6366f1",
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: "#6366f1",
        fill: { target: 1, above: "rgba(99,102,241,0.12)", below: "rgba(239,68,68,0.12)" },
      },
      {
        label: "Target (75%)",
        data: trends.map(() => 75),
        borderColor: "rgba(156,163,175,0.7)",
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  } : null;

  const yieldChartData = yield_?.total > 0 ? {
    labels: ["Proficient (≥85%)", "Developing (75–84%)", "Emerging (<75%)"],
    datasets: [{
      data: [yield_.proficient, yield_.developing, yield_.emerging],
      backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
      borderWidth: 0,
      hoverBorderWidth: 0,
    }],
  } : null;


  // ── Contextual insights ───────────────────────────────────────────────────────
  const masteryInsight = masteryGap != null
    ? masteryGap >= 0
      ? `Currently ${masteryGap}% above the 75% target`
      : `Currently ${Math.abs(masteryGap)}% below the 75% target — intervention recommended`
    : null;

  const yieldInsight = (yield_?.total > 0 && atRiskCount != null)
    ? `${atRiskCount} of ${yield_.total} students (${Math.round(atRiskCount / yield_.total * 100)}%) in the Emerging band (below the 75% passing threshold)`
    : null;

  return (
    <div className="space-y-6">

      {/* KPI Summary Cards (item 1) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(loadingTrends || loadingYield || loadingSubjects) ? (
          Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="At-Risk Students"
              value={atRiskCount}
              sub="Emerging (<75%)"
              colorClass="bg-red-50 border-red-200 text-red-700"
            />
            <KpiCard
              label="Mastery vs Target"
              value={masteryGap != null ? `${masteryGap >= 0 ? "+" : ""}${masteryGap}%` : null}
              sub="vs 75% benchmark"
              colorClass={masteryGap != null && masteryGap < 0
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-indigo-50 border-indigo-200 text-indigo-700"
              }
            />
            <KpiCard
              label="Enrollment Change"
              value={enrollmentChange != null ? `${enrollmentChange >= 0 ? "+" : ""}${enrollmentChange}` : null}
              sub="vs previous period"
              colorClass="bg-gray-50 border-gray-200 text-gray-700"
            />
            <KpiCard
              label="Avg Failure Rate"
              value={overallFailureRate != null ? `${overallFailureRate}%` : null}
              sub="across all subjects"
              colorClass={overallFailureRate != null && overallFailureRate >= 30
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
              }
            />
          </>
        )}
      </div>

      {/* Curriculum Mastery Report + Enrollment Yield */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Curriculum Mastery Report */}
        <SectionCard
          title="Curriculum Mastery Report"
          action={<ExportBtn chartRef={masteryRef} filename="curriculum-mastery" />}
        >
          {loadingTrends ? (
            <ChartSkeleton height="h-60" />
          ) : masteryData ? (
            <>
              <div className="relative h-60">
                <Line
                  ref={masteryRef}
                  data={masteryData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } } },
                    scales: {
                      y: { min: 0, max: 100, ticks: { callback: v => `${v}%`, font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" } },
                      x: { ticks: { font: { size: 10 } } },
                    },
                  }}
                />
              </div>
              {masteryInsight && (
                <p className={`text-xs mt-2 flex items-center gap-1.5 ${masteryGap != null && masteryGap < 0 ? "text-red-500" : "text-indigo-500"}`}>
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${masteryGap != null && masteryGap < 0 ? "bg-red-400" : "bg-indigo-400"}`} />
                  {masteryInsight}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-300 text-sm">No mastery data yet</div>
          )}
        </SectionCard>

        {/* Enrollment Yield — donut with center label + custom legend */}
        <SectionCard
          title="Enrollment Yield"
          action={<ExportBtn chartRef={yieldRef} filename="enrollment-yield" />}
        >
          {loadingYield ? (
            <DonutSkeleton />
          ) : yieldChartData ? (
            <>
              <div className="relative w-40 h-40 mx-auto">
                <Doughnut
                  ref={yieldRef}
                  data={yieldChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "62%",
                    plugins: { legend: { display: false } },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-800">{yield_.total}</span>
                  <span className="text-xs text-gray-400">students</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: "Proficient (≥85%)",   value: yield_.proficient, color: "bg-green-500" },
                  { label: "Developing (75–84%)", value: yield_.developing, color: "bg-amber-500" },
                  { label: "Emerging (<75%)",     value: yield_.emerging,   color: "bg-red-500"   },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                    <span className="text-xs text-gray-600 flex-1 truncate">{label}</span>
                    <span className="text-xs font-semibold text-gray-700 shrink-0">{value}</span>
                    <span className="text-xs text-gray-400 shrink-0 w-8 text-right">
                      {yield_.total > 0 ? `${Math.round(value / yield_.total * 100)}%` : "0%"}
                    </span>
                  </div>
                ))}
              </div>
              {yieldInsight && (
                <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">{yieldInsight}</p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No yield data yet</div>
          )}
        </SectionCard>
      </div>

      {/* Subject Mastery Overview — color-coded table (item 7) */}
      {(loadingSubjects || subjects?.length > 0) && (
        <SectionCard title="Subject Mastery Overview">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 uppercase tracking-wide">Subject</th>
                  <th className="text-center py-2 pr-4 font-medium text-gray-500 uppercase tracking-wide w-24">Avg Score</th>
                  <th className="text-center py-2 pr-4 font-medium text-gray-500 uppercase tracking-wide w-24">Failure Rate</th>
                  <th className="text-center py-2 font-medium text-gray-500 uppercase tracking-wide w-20">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingSubjects
                  ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                  : [...subjects].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0)).map(s => {
                  const scoreColor =
                    (s.avg_score || 0) >= 85 ? "bg-blue-100 text-blue-700"
                    : (s.avg_score || 0) >= 75 ? "bg-green-100 text-green-700"
                    : (s.avg_score || 0) >= 60 ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700";
                  const failColor =
                    s.failure_rate >= 50 ? "bg-red-100 text-red-700"
                    : s.failure_rate >= 30 ? "bg-amber-100 text-amber-700"
                    : "bg-green-50 text-green-700";
                  return (
                    <tr key={s.course_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 pr-4">
                        <span className="font-mono font-semibold text-indigo-600 mr-2">{s.course_code}</span>
                        <span className="text-gray-600">{s.course_title}</span>
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${scoreColor}`}>
                          {s.avg_score != null ? `${s.avg_score}%` : "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${failColor}`}>
                          {s.failure_rate}%
                        </span>
                      </td>
                      <td className="py-2 text-center text-gray-500">{s.total_students ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loadingSubjects && (
          <p className="text-xs text-gray-400 mt-3">
            Color key: <span className="text-green-600">≥85% proficient</span> · <span className="text-amber-600">75–84% developing</span> · <span className="text-red-600">&lt;75% emerging</span>
          </p>
          )}
        </SectionCard>
      )}

      {/* AI Logic Visualization — interactive pipeline (item 6) */}
      <SectionCard title="AI Logic Visualization">
        <p className="text-xs text-gray-400 mb-5">
          How AILAS processes data from ingestion to insights{!loadingStats && " — hover each stage for details"}
        </p>
        <div className="flex items-center justify-start sm:justify-center flex-nowrap gap-1 overflow-x-auto py-2 -mx-2 px-2">
          <PipelineNode label="Data Ingestion"      sub="PDF · DOCX · CSV"     color="border-blue-200 bg-blue-50 text-blue-800"      icon="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"                                                                                                                               tooltip={`${stats?.total_syllabi ?? 0} syllabi · ${stats?.total_courses ?? 0} courses`} />
          <PipelineArrow />
          <PipelineNode label="OCR Extraction"      sub="Tesseract"            color="border-amber-200 bg-amber-50 text-amber-800"    icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"                                                                                         tooltip={`${stats?.total_syllabi ?? 0} documents processed`} />
          <PipelineArrow />
          <PipelineNode label="AI Logic Core"       sub="GPT-4o-mini · LLM API" color="border-indigo-200 bg-indigo-50 text-indigo-800" icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.001 3.001 0 0012 15a3 3 0 00-2.971 2.589l-.347-.346z"  tooltip="Confidence threshold: ≥0.75" />
          <PipelineArrow />
          <PipelineNode label="Risk Classification"     sub="Rule-Based Engine"    color="border-red-200 bg-red-50 text-red-800"          icon="M13 10V3L4 14h7v7l9-11h-7z"                                                                                                                                                                                 tooltip={`${stats?.total_students ?? 0} students analyzed`} />
          <PipelineArrow />
          <PipelineNode label="Recommendations"     sub="Tag-Match"            color="border-green-200 bg-green-50 text-green-800"    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"                                                               tooltip={`${stats?.total_resources ?? 0} resources available`} />
          <PipelineArrow />
          <PipelineNode label="Actionable Insights" sub="Dashboards · Alerts"  color="border-purple-200 bg-purple-50 text-purple-800" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" tooltip={`${stats?.total_users ?? 0} active users`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
          {[
            { label: "Topic Classification Logic", desc: "GPT-4o-mini receives question text and syllabus topics, returns the best-matching topic with a confidence score. Items below the 0.75 confidence threshold are flagged for instructor review." },
            { label: "Risk Classification Rules",      desc: "Rule-Based Engine applies deterministic thresholds on competency mastery and period-over-period grade decline. Outputs At-Risk · On-Track · Excelling." },
            { label: "Recommendation Engine",      desc: "Tag-Match Recommender queries resources whose competency tags overlap with the student's weak competency codes and topic names, ranked by match count." },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">{item.label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? "System-wide performance data" : "Per-course student performance"}
          </p>
        </div>

        {isAdmin ? <AdminAnalytics /> : <InstructorAnalytics />}
      </div>
    </Layout>
  );
}
