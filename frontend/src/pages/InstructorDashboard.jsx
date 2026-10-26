import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const INTERVENTION_TYPE_LABELS = {
  academic_counseling:         "Academic Counseling",
  tutoring_referral:           "Tutoring Referral",
  study_skills_workshop:       "Study Skills Workshop",
  peer_mentoring:              "Peer Mentoring",
  modified_learning_strategy:  "Modified Learning Strategy",
  time_management_coaching:    "Time Management Coaching",
  wellness_support_referral:   "Wellness Support Referral",
  general_note:                "General Note",
};
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const PAGE_SIZE = 5;

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function refreshedAgo(date) {
  if (!date) return null;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-gray-200 rounded-lg shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function RowSkeleton({ cols = 2 }) {
  return (
    <div className="animate-pulse flex items-center gap-3 py-2">
      <div className="w-6 h-4 bg-gray-200 rounded shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
      {cols > 1 && <div className="w-12 h-4 bg-gray-200 rounded shrink-0" />}
    </div>
  );
}

function StatCard({ label, value, colorClass, icon }) {
  return (
    <div className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-gray-800 leading-none">{value ?? "—"}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children, className = "", action }) {
  return (
    <div className={`bg-white shadow-sm hover:shadow-md transition-shadow duration-200 rounded-xl border border-gray-200 p-5 flex flex-col ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 shrink-0">
          {title && <h2 className="text-base font-semibold text-gray-700">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
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

export default function InstructorDashboard() {
  const { user } = useAuth();
  const {
    data: instructorCourses,
    loading: loadingCourses,
    refetch: refetchCourses,
  } = useApi("/analytics/instructor/course-summaries");

  const [program, setProgram] = useState("All");
  const [academicYear, setAcademicYear] = useState("All");
  const [semester, setSemester] = useState("All");

  const [topPage, setTopPage] = useState(1);
  const [attnPage, setAttnPage] = useState(1);
  const [sortAttn, setSortAttn] = useState("desc");
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [interventionTypeFilter, setInterventionTypeFilter] = useState("");

  const interventionUrl = interventionTypeFilter
    ? `/analytics/instructor/interventions?type=${interventionTypeFilter}`
    : "/analytics/instructor/interventions";
  const { data: recentInterventions } = useApi(interventionUrl, [interventionTypeFilter]);
  const { data: allConsultations } = useApi("/analytics/instructor/consultations");
  const { data: standingSummary } = useApi("/analytics/instructor/standing-summary");

  const today = new Date().toISOString().slice(0, 10);
  const incConsultations = (allConsultations ?? []).filter(c => c.academic_status === "incomplete");

  useEffect(() => {
    if (instructorCourses !== null) setLastRefreshed(new Date());
  }, [instructorCourses]);

  useEffect(() => { setAttnPage(1); }, [sortAttn]);

  const handleRefresh = useCallback(() => {
    refetchCourses();
  }, [refetchCourses]);

  const courses = instructorCourses ?? [];

  const filteredCourses = courses.filter(c => {
    if (program !== "All" && c.program && c.program !== program) return false;
    if (academicYear !== "All" && c.academic_year && c.academic_year !== academicYear) return false;
    if (semester !== "All" && c.semester && c.semester !== semester) return false;
    return true;
  });

  const totalStudents = filteredCourses.reduce((s, c) => s + (c.total_students || 0), 0);
  const overallAvg = filteredCourses.length
    ? (filteredCourses.reduce((s, c) => s + (c.avg_score || 0), 0) / filteredCourses.length).toFixed(1)
    : "—";
  const atRiskCourses = filteredCourses.filter(c => c.failure_rate >= 50);
  const criticalCourses = atRiskCourses;

  const topPerforming = [...filteredCourses].sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));

  const needsAttention = filteredCourses
    .filter(c => c.failure_rate > 25)
    .sort((a, b) =>
      sortAttn === "desc"
        ? b.failure_rate - a.failure_rate
        : a.failure_rate - b.failure_rate
    );

  const isRefreshing = loadingCourses;

  const chartData = {
    labels: filteredCourses.map(c => c.course_code),
    datasets: [
      {
        label: "Failure Rate %",
        data: filteredCourses.map(c => c.failure_rate || 0),
        backgroundColor: filteredCourses.map(c =>
          c.failure_rate >= 50 ? "#f87171" : c.failure_rate >= 25 ? "#fbbf24" : "#34d399"
        ),
        borderRadius: 4,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: items => items[0].label,
          label: item => `Failure rate: ${item.raw}%`,
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { font: { size: 10 }, callback: v => `${v}%` },
        grid: { color: "#f3f4f6" },
      },
    },
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">{user?.full_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Program",       value: program,      setter: setProgram,      opts: ["All", "BSIT", "BSCS", "BSA", "BSBA", "BEEd", "BSEd"] },
              { label: "Academic Year", value: academicYear, setter: setAcademicYear, opts: ["All", "2023-2024", "2024-2025", "2025-2026"] },
              { label: "Semester",      value: semester,     setter: setSemester,     opts: ["All", "1st Sem", "2nd Sem", "Summer"] },
            ].map(({ label, value, setter, opts }) => (
              <select
                key={label}
                value={value}
                onChange={e => setter(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            <div className="w-px h-5 bg-gray-200" />
            <button
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              disabled={isRefreshing}
              onClick={handleRefresh}
              title="Refresh data"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {lastRefreshed && (
              <span className="text-xs text-gray-400 hidden sm:block">
                Refreshed {refreshedAgo(lastRefreshed)}
              </span>
            )}
          </div>
        </div>

        {/* Critical alert banner */}
        {criticalCourses.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">High Failure Rate Alert</p>
              <p className="text-xs text-red-600 mt-0.5">
                {criticalCourses.length} course{criticalCourses.length !== 1 ? "s" : ""}{" "}
                {criticalCourses.length !== 1 ? "have" : "has"} a failure rate at or above 50%:{" "}
                {criticalCourses.map(c => c.course_code).join(", ")}.
              </p>
            </div>
          </div>
        )}

        {/* T5-D-07: Probation / dismissal-risk student banner */}
        {standingSummary && (standingSummary.probation > 0 || standingSummary.dismissal_risk > 0) && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-800">Academic Standing Alert</p>
              <p className="text-xs text-orange-700 mt-0.5">
                {[
                  standingSummary.dismissal_risk > 0 && `${standingSummary.dismissal_risk} student${standingSummary.dismissal_risk !== 1 ? "s" : ""} at dismissal risk`,
                  standingSummary.probation > 0      && `${standingSummary.probation} on probation`,
                  standingSummary.warning > 0        && `${standingSummary.warning} on warning`,
                ].filter(Boolean).join(" · ")}.{" "}
                See the Academic Standing section below.
              </p>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loadingCourses && !instructorCourses ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Total Classes"
                value={filteredCourses.length || "—"}
                colorClass="bg-indigo-50 text-indigo-600"
                icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
              <StatCard
                label="Total Students"
                value={totalStudents || "—"}
                colorClass="bg-blue-50 text-blue-600"
                icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
              <StatCard
                label="Overall Avg Score"
                value={overallAvg !== "—" ? `${overallAvg}%` : "—"}
                colorClass="bg-green-50 text-green-600"
                icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
              <StatCard
                label="High-Risk Courses"
                value={atRiskCourses.length || "—"}
                colorClass="bg-red-50 text-red-500"
                icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </>
          )}
        </div>

        {/* 2-column grid: rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Top Performing Classes */}
          <SectionCard title="Top Performing Classes">
            {loadingCourses && !instructorCourses ? (
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
              </div>
            ) : topPerforming.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-xs text-gray-400">No course data yet.</p>
                <p className="text-xs text-gray-300 mt-0.5">Upload scores via Ingestion Module.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-0.5">
                  {topPerforming.slice((topPage - 1) * PAGE_SIZE, topPage * PAGE_SIZE).map((c, i) => (
                    <div key={c.course_id} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <span className="text-xs font-bold text-gray-300 w-4 shrink-0">
                        {(topPage - 1) * PAGE_SIZE + i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-indigo-600">{c.course_code}</p>
                        <p className="text-xs text-gray-600 truncate">{c.course_title}</p>
                      </div>
                      <span className="text-sm font-bold text-green-600 shrink-0">{c.avg_score}%</span>
                    </div>
                  ))}
                </div>
                <Pagination page={topPage} total={topPerforming.length} pageSize={PAGE_SIZE} onChange={setTopPage} />
              </>
            )}
          </SectionCard>

          {/* Classes Needing Attention */}
          <SectionCard
            title="Classes Needing Attention"
            action={
              <button
                onClick={() => setSortAttn(s => s === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                title={sortAttn === "desc" ? "Show lowest first" : "Show highest first"}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d={sortAttn === "desc"
                      ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                      : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                    }
                  />
                </svg>
                {sortAttn === "desc" ? "Highest" : "Lowest"}
              </button>
            }
          >
            {loadingCourses && !instructorCourses ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
              </div>
            ) : needsAttention.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-green-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-xs text-gray-400">All classes are on track.</p>
                <p className="text-xs text-gray-300 mt-0.5">No classes above 25% failure rate.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-0.5">
                  {needsAttention.slice((attnPage - 1) * PAGE_SIZE, attnPage * PAGE_SIZE).map(c => (
                    <div key={c.course_id} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-red-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-red-500">{c.course_code}</p>
                        <p className="text-xs text-gray-600 truncate">{c.course_title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600">{c.failure_rate}%</p>
                        <p className="text-xs text-gray-400">fail rate</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination page={attnPage} total={needsAttention.length} pageSize={PAGE_SIZE} onChange={setAttnPage} />
              </>
            )}
          </SectionCard>

        </div>

        {/* Course Failure Rate Overview + My Course Performance in one row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Course Failure Rate Overview */}
          <SectionCard title="Course Failure Rate Overview">
            {loadingCourses && !instructorCourses ? (
              <div className="h-52 animate-pulse bg-gray-100 rounded-lg" />
            ) : filteredCourses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-xs text-gray-400">No data to chart.</p>
              </div>
            ) : (
              <>
                <figure aria-label="Student risk distribution bar chart" className="h-52">
                  <Bar data={chartData} options={chartOptions} />
                </figure>
                <div className="flex gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span>≥50% Critical</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>26–49% Concern</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <span>≤25% Good</span>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
          {/* My Course Performance */}
          <SectionCard title="My Course Performance">
          {loadingCourses && !instructorCourses ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} cols={2} />)}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <svg className="w-10 h-10 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-400">No course data yet.</p>
              <p className="text-xs text-gray-300 mt-0.5">Upload assessment scores via the Ingestion Module.</p>
              <Link to="/instructor/processing" className="text-xs text-indigo-600 hover:underline mt-2 block">
                Go to Ingestion Module →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCourses.map(s => {
                const failColor = s.failure_rate > 50 ? "text-red-600" : s.failure_rate > 25 ? "text-amber-600" : "text-green-600";
                const barColor  = s.failure_rate > 50 ? "bg-red-400"   : s.failure_rate > 25 ? "bg-amber-400"   : "bg-green-400";
                return (
                  <div key={s.course_id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0 flex items-center gap-1">
                        <span className="text-xs font-mono text-indigo-600 mr-1.5 shrink-0">{s.course_code}</span>
                        <span className="text-sm text-gray-700 truncate">{s.course_title}</span>
                        <span className="text-xs text-gray-400 ml-2 shrink-0">{s.total_students} students</span>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <span className={`text-sm font-bold ${failColor}`}>{s.failure_rate}% failing</span>
                        <p className="text-xs text-gray-400">avg {s.avg_score}%</p>
                        {(s.formative_avg != null || s.summative_avg != null) && (
                          <div className="flex gap-1.5 justify-end mt-0.5">
                            {s.formative_avg != null && (
                              <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full">F {s.formative_avg}%</span>
                            )}
                            {s.summative_avg != null && (
                              <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full">S {s.summative_avg}%</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${barColor}`}
                        style={{ width: `${s.failure_rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
        </div>

        {/* Attendance + Recent Interventions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Attendance summary card */}
          <SectionCard title="Attendance">
            <div className="flex flex-col gap-4">
              <p className="text-xs text-gray-400">
                Attendance is recorded for context only — it does not drive the At-Risk flag. Students are flagged At-Risk solely by academic signals: 3 or more competencies below the 75% passing threshold, or an average decline of more than 15% between grading periods. Record and view attendance per class in My Classes.
              </p>
              {/* P / A / L / E summary legend */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "P", title: "Present", pill: "bg-green-100 text-green-700", dot: "bg-green-500" },
                  { label: "A", title: "Absent",  pill: "bg-red-100 text-red-700",     dot: "bg-red-500"   },
                  { label: "L", title: "Late",    pill: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
                  { label: "E", title: "Excused", pill: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"  },
                ].map(s => (
                  <span key={s.label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${s.pill}`}>
                    <span className={`w-3.5 h-3.5 rounded-full ${s.dot} text-white flex items-center justify-center text-xs font-bold`}>{s.label}</span>
                    {s.title}
                  </span>
                ))}
              </div>
              <Link
                to="/my-classes"
                className="w-full text-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Record Attendance in My Classes →
              </Link>
            </div>
          </SectionCard>

          {/* T4-A-07: Recent Interventions with type filter */}
          <SectionCard
            title="Recent Interventions"
            action={
              <select
                value={interventionTypeFilter}
                onChange={e => setInterventionTypeFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Types</option>
                {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            }
          >
            {!recentInterventions?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-gray-400">No interventions logged yet.</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Log interventions from the Intervention Alerts page.
                </p>
                <Link to="/intervention-alerts" className="text-xs text-indigo-600 hover:underline mt-2">
                  Go to Alerts →
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {recentInterventions.map(iv => {
                  const typeLabel = iv.intervention_type
                    ? (INTERVENTION_TYPE_LABELS[iv.intervention_type] ?? iv.intervention_type)
                    : "Note";
                  const followUpPastDue = iv.follow_up_date && iv.follow_up_date < today;
                  return (
                    <div key={iv.id} className={`flex items-start gap-2 px-2 py-1.5 -mx-2 rounded-lg transition-colors ${
                      followUpPastDue ? "bg-red-50 border border-red-100" : "hover:bg-gray-50"
                    }`}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 shrink-0 mt-0.5">
                        {typeLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        {iv.note && <p className="text-xs text-gray-600 truncate">{iv.note}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-gray-400">{new Date(iv.created_at).toLocaleDateString()}</p>
                          {followUpPastDue && (
                            <span className="text-xs font-semibold text-red-600">Follow-up overdue: {iv.follow_up_date}</span>
                          )}
                          {iv.follow_up_date && !followUpPastDue && (
                            <span className="text-xs text-amber-600">Follow-up: {iv.follow_up_date}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

        </div>

        {/* T5-A-08 + T5-B-04: Grade Consultations + INC Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <SectionCard
            title="Grade Consultations"
            action={
              <Link to="/instructor/grade-consultation" className="text-xs text-indigo-600 hover:underline font-medium">
                Log Consultation →
              </Link>
            }
          >
            {!allConsultations ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
              </div>
            ) : allConsultations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-gray-400">No consultations logged yet.</p>
                <Link to="/instructor/grade-consultation" className="text-xs text-indigo-600 hover:underline mt-2">
                  Log first consultation →
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {allConsultations.slice(0, 8).map(c => {
                  const STATUS_BADGE = {
                    passed:     "bg-green-100 text-green-700",
                    failed:     "bg-red-100 text-red-700",
                    incomplete: "bg-amber-100 text-amber-700",
                    dropped:    "bg-gray-100 text-gray-600",
                  };
                  const badge = STATUS_BADGE[c.academic_status] ?? "bg-gray-100 text-gray-600";
                  return (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge}`}>
                        {c.academic_status ? c.academic_status.charAt(0).toUpperCase() + c.academic_status.slice(1) : "—"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{c.full_name ?? "Student"}</p>
                        {c.notes && <p className="text-xs text-gray-400 truncate">{c.notes}</p>}
                      </div>
                      <span className="text-xs text-gray-300 shrink-0">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="INC Tracker">
            {incConsultations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <svg className="w-8 h-8 text-green-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-gray-400">No incomplete grades on record.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {incConsultations.map(c => {
                  const isOverdue = c.completion_deadline && c.completion_deadline < today;
                  return (
                    <div key={c.id} className={`rounded-lg border px-3 py-2.5 ${isOverdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-100"}`}>
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-gray-700 truncate">{c.full_name ?? "Student"}</p>
                        {c.completion_deadline && (
                          <span className={`text-xs font-semibold shrink-0 ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                            {isOverdue ? "OVERDUE" : `Due: ${c.completion_deadline}`}
                          </span>
                        )}
                      </div>
                      {c.completion_deadline && isOverdue && (
                        <p className="text-xs text-red-500">Deadline: {c.completion_deadline}</p>
                      )}
                      {c.incomplete_reason && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">Reason: {c.incomplete_reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

        </div>

        {/* T5-D-08: Academic Standing student table */}
        {standingSummary && (standingSummary.students?.length > 0) && (
          <SectionCard title="Academic Standing — Students Requiring Attention">
            <div className="flex gap-4 mb-4 flex-wrap">
              {[
                { label: "Warning",        count: standingSummary.warning,        bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
                { label: "Probation",      count: standingSummary.probation,      bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
                { label: "Dismissal Risk", count: standingSummary.dismissal_risk, bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
              ].map(({ label, count, bg, text, border }) => (
                count > 0 && (
                  <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg} ${border}`}>
                    <span className={`text-lg font-bold ${text}`}>{count}</span>
                    <span className={`text-xs ${text}`}>{label}</span>
                  </div>
                )
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">Student</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">Student No.</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">Course</th>
                    <th className="text-left py-2 font-semibold text-gray-500">Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {standingSummary.students.map((s, i) => {
                    const STANDING_BADGE = {
                      warning:        "bg-amber-100 text-amber-700",
                      probation:      "bg-orange-100 text-orange-700",
                      dismissal_risk: "bg-red-100 text-red-700",
                    };
                    const STANDING_LABEL = {
                      warning:        "Warning",
                      probation:      "Probation",
                      dismissal_risk: "Dismissal Risk",
                    };
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2 pr-4 font-medium text-gray-700">{s.full_name}</td>
                        <td className="py-2 pr-4 text-gray-500 font-mono">{s.student_number ?? "—"}</td>
                        <td className="py-2 pr-4 text-indigo-600 font-mono">{s.course_code}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${STANDING_BADGE[s.standing] ?? "bg-gray-100 text-gray-600"}`}>
                            {STANDING_LABEL[s.standing] ?? s.standing}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* AI Logic Visualization */}
        <SectionCard title="AI Logic Visualization">
          <p className="text-xs text-gray-400 mb-5">How AILAS processes data from ingestion to insights</p>
          <div className="flex items-center justify-start sm:justify-center flex-nowrap gap-1 overflow-x-auto py-2 -mx-2 px-2">
            <PipelineNode label="Data Ingestion"    sub="PDF · DOCX · CSV"         color="border-blue-200 bg-blue-50 text-blue-800"     icon="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            <PipelineArrow />
            <PipelineNode label="OCR Extraction"   sub="Tesseract"                 color="border-amber-200 bg-amber-50 text-amber-800"   icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            <PipelineArrow />
            <PipelineNode label="AI Logic Core"    sub="GPT-4o-mini · LLM API"      color="border-indigo-200 bg-indigo-50 text-indigo-800" icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.001 3.001 0 0012 15a3 3 0 00-2.971 2.589l-.347-.346z" />
            <PipelineArrow />
            <PipelineNode label="Risk Prediction"  sub="Rule-Based Engine"          color="border-red-200 bg-red-50 text-red-800"         icon="M13 10V3L4 14h7v7l9-11h-7z" />
            <PipelineArrow />
            <PipelineNode label="Recommendations"  sub="Tag-Match"                  color="border-green-200 bg-green-50 text-green-800"   icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            <PipelineArrow />
            <PipelineNode label="Actionable Insights" sub="Dashboards · Alerts"   color="border-purple-200 bg-purple-50 text-purple-800" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
            {[
              { label: "Topic Classification Logic", desc: "GPT-4o-mini receives question text and syllabus topics, returns the best-matching topic with a confidence score. Items below the 0.75 confidence threshold are flagged for instructor review." },
              { label: "Risk Prediction Model",      desc: "Rule-Based Engine applies deterministic thresholds on competency mastery and period-over-period grade decline. Outputs At-Risk · On-Track · Excelling." },
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
    </Layout>
  );
}
