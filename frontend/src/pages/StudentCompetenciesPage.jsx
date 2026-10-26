import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 10;

function MasteryBar({ score, isWeak }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWeak ? "bg-red-400" : "bg-indigo-500"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${
        isWeak ? "text-red-600" : score >= 85 ? "text-blue-600" : "text-green-600"
      }`}>
        {score.toFixed(1)}%
      </span>
    </div>
  );
}

function CourseSection({ course }) {
  const { data: scores, loading } = useApi(
    `/analytics/me/competency-scores?course_id=${course.id}`, [course.id]
  );
  const [expanded, setExpanded] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [course.id]);

  const weakCount = scores?.filter(s => s.is_weak).length ?? 0;
  const total = scores?.length ?? 0;
  const mastery = total > 0 ? Math.round(((total - weakCount) / total) * 100) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0">
            {course.code}
          </span>
          <p className="text-sm font-semibold text-gray-800 truncate">{course.title}</p>
          {course.academic_period && (
            <span className="text-xs text-gray-400 hidden sm:inline shrink-0">{course.academic_period}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!loading && mastery !== null && (
            <>
              {weakCount > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  {weakCount} weak
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                mastery >= 80 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>
                {mastery}% mastery
              </span>
            </>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Loading competencies…</div>
          ) : !scores?.length ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No competency data yet for this course.
            </div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                  <th className="px-5 py-2.5 text-left">Code</th>
                  <th className="px-5 py-2.5 text-left">Topic</th>
                  <th className="px-5 py-2.5 text-left w-48">Mastery</th>
                  <th className="px-5 py-2.5 text-right w-20">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...scores].sort((a, b) => a.average_score - b.average_score).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(c => (
                  <tr key={c.competency_code} className={`hover:bg-gray-50 ${c.is_weak ? "bg-red-50/30" : ""}`}>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-600">{c.competency_code}</td>
                    <td className="px-5 py-3 text-gray-700">{c.topic_name}</td>
                    <td className="px-5 py-3 w-48">
                      <MasteryBar score={c.average_score} isWeak={c.is_weak} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.is_weak ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          Weak
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Passing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={scores.length} pageSize={PAGE_SIZE} onChange={setPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentCompetenciesPage() {
  const { data: courses, loading } = useApi("/analytics/me/courses");
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? (courses || [])
    : (courses || []).filter(c => c.id === filter);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">My Competencies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your competency mastery across all enrolled courses
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            Loading courses…
          </div>
        ) : !(courses || []).length ? (
          <div className="bg-white border border-gray-200 rounded-xl py-20 text-center">
            <p className="text-sm text-gray-500">No course data yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Your instructor needs to upload assessment scores first.
            </p>
          </div>
        ) : (
          <>
            {/* Course filter pills */}
            {courses.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    filter === "all"
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  All Courses ({courses.length})
                </button>
                {courses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filter === c.id
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    <span className="font-mono">{c.code}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Course sections */}
            <div className="space-y-4">
              {filtered.map(c => (
                <CourseSection key={c.id} course={c} />
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded bg-red-400 inline-block" />
                Weak (below 75%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded bg-indigo-500 inline-block" />
                Passing (75%+)
              </span>
              <span className="ml-auto">Sorted weakest first per course</span>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
