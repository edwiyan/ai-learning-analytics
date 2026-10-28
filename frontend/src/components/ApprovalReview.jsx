import { useEffect, useState } from "react";
import api from "../services/api";
import { useApi } from "../hooks/useApi";
import { PERIOD_LABELS, courseLine } from "../utils/approvalReview";

// Review packets shown to the Program Director, Dean and VP before they approve or
// endorse a syllabus, an assessment or a grade submission (GET /…/{id}/review).

const TYPE_LABELS = { multiple_choice: "Multiple Choice", short_answer: "Short Answer", problem: "Problem Solving" };
const ROLE_LABELS = {
  program_director: "Program Director", dean: "Dean", vp_academic_affairs: "VP Academic Affairs",
};

function Section({ title, children, aside }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CourseHeader({ course, extra = [] }) {
  if (!course) return null;
  const rows = [
    ["Course", courseLine(course)],
    ["Academic period", course.academic_period],
    ["Instructor", course.instructor_name ? `${course.instructor_name}${course.instructor_email ? ` (${course.instructor_email})` : ""}` : "—"],
    ["College", course.college || "—"],
    ...extra,
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 bg-gray-50 rounded-xl p-4 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between sm:block gap-3">
          <dt className="text-gray-400">{k}</dt>
          <dd className="text-gray-700 font-medium sm:mt-0.5">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ApprovalTimeline({ history }) {
  return (
    <Section title="Approval history">
      {!history?.length ? (
        <p className="text-xs text-gray-400">No decisions yet — you are the first reviewer.</p>
      ) : (
        <ol className="space-y-2">
          {history.map((h, i) => {
            const ok = h.status === "approved";
            const word = ok && h.role === "vp_academic_affairs" ? "endorsed" : h.status;
            return (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
                <div className="min-w-0">
                  <p className="text-xs text-gray-700">
                    <span className="font-medium">{ROLE_LABELS[h.role] || h.role}</span>
                    {h.approver_name && <span className="text-gray-500"> · {h.approver_name}</span>}
                    {" "}<span className={ok ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{word}</span>
                  </p>
                  {h.feedback && <p className="text-xs text-gray-500 italic">"{h.feedback}"</p>}
                  {h.reviewed_at && <p className="text-[11px] text-gray-400">{new Date(h.reviewed_at).toLocaleString()}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

async function downloadSyllabus(id) {
  const res = await api.get(`/syllabi/${id}/file`, { responseType: "blob" });
  const match = /filename="?([^";]+)"?/.exec(res.headers["content-disposition"] || "");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(res.data),
    download: match ? match[1] : `syllabus-${id.slice(0, 8)}`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function SyllabusReviewBody({ data }) {
  const [dlError, setDlError] = useState("");
  const outcomeCount = data.competencies.reduce((n, c) => n + c.learning_outcomes.length, 0);
  return (
    <div className="space-y-5">
      <CourseHeader course={data.course} extra={[["Title on the document", data.submitted_title || "—"]]} />

      <div className="flex items-center gap-3 flex-wrap">
        {data.has_file ? (
          <button
            onClick={() => downloadSyllabus(data.id).catch(() => setDlError("Download failed."))}
            className="text-xs border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
            Download original syllabus{data.file_name ? ` (${data.file_name.split(".").pop().toUpperCase()})` : ""}
          </button>
        ) : (
          <span className="text-xs text-gray-400">Original file is not available on the server.</span>
        )}
        {dlError && <span className="text-xs text-red-500">{dlError}</span>}
      </div>

      <Section title="Competencies under review"
        aside={<span className="text-xs text-gray-400">{data.competencies.length} competencies · {outcomeCount} learning outcomes</span>}>
        {data.competencies.length === 0 ? (
          <p className="text-xs text-amber-700">This syllabus has no competencies.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {data.competencies.map(c => (
              <div key={c.competency_code} className="px-4 py-3">
                <p className="text-sm text-gray-800">
                  <span className="font-mono text-xs text-indigo-600 mr-2">{c.competency_code}</span>
                  <span className="font-medium">{c.topic_name}</span>
                </p>
                {c.learning_outcomes.length > 0 ? (
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    {c.learning_outcomes.map((lo, i) => <li key={i} className="text-xs text-gray-600">{lo}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">No learning outcomes listed.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <ApprovalTimeline history={data.history} />
    </div>
  );
}

export function AssessmentReviewBody({ data }) {
  return (
    <div className="space-y-5">
      <CourseHeader course={data.course} extra={[
        ["Type", <span key="t" className="capitalize">{data.type}{data.assessment_category ? ` · ${data.assessment_category}` : ""}</span>],
        ["Grading period", PERIOD_LABELS[data.grading_period] || data.grading_period],
        ["Date", data.date ? new Date(data.date).toLocaleDateString() : "—"],
        ["Total", `${data.questions.length} questions · ${data.total_points} points`],
      ]} />

      <Section title="Table of Specifications">
        {data.tos.length === 0 ? (
          <p className="text-xs text-amber-700">No Table of Specifications was set for this assessment.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Competency</th>
                  <th className="text-left font-medium px-3 py-2">Bloom level</th>
                  <th className="text-right font-medium px-3 py-2">Items</th>
                  <th className="text-right font-medium px-3 py-2">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.tos.map((t, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-700"><span className="font-mono text-indigo-600">{t.competency_code}</span> {t.topic_name}</td>
                    <td className="px-3 py-2 text-gray-600">{t.bloom_level || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.item_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.weight_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Questions">
        {data.questions.length === 0 ? (
          <p className="text-xs text-amber-700">No questions were drafted in AILAS for this assessment.</p>
        ) : (
          <ol className="space-y-3">
            {data.questions.map(q => (
              <li key={q.number} className="border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    <span className="font-semibold mr-1">{q.number}.</span>{q.question_text}
                  </p>
                  <span className="text-xs text-gray-500 shrink-0 tabular-nums">{q.points} pt{q.points === 1 ? "" : "s"}</span>
                </div>
                {q.choices.length > 0 && (
                  <ol className="mt-1.5 ml-5 space-y-0.5 list-[upper-alpha]">
                    {q.choices.map((c, i) => <li key={i} className="text-xs text-gray-600">{c}</li>)}
                  </ol>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABELS[q.question_type] || q.question_type}</span>
                  {q.competency_code && <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{q.competency_code} · {q.topic_name}</span>}
                  {q.bloom_level && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{q.bloom_level}</span>}
                </div>
                {q.answer_key && (
                  <p className="mt-2 text-xs text-emerald-700"><span className="font-medium">Answer key:</span> {q.answer_key}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <ApprovalTimeline history={data.history} />
    </div>
  );
}

export function GradeReviewBody({ data }) {
  const s = data.summary;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = q
    ? data.roster.filter(r => [r.student_name, r.student_number, r.section].some(v => v && v.toLowerCase().includes(q)))
    : data.roster;
  const fmt = v => (v == null ? "—" : `${v.toFixed(2)}%`);
  const weightText = Object.keys(data.weights || {}).length
    ? Object.entries(data.weights).map(([k, v]) => `${k} ${v}%`).join(" · ")
    : "Simple average (no weights set)";

  return (
    <div className="space-y-5">
      <CourseHeader course={data.course} extra={[
        ["Grading period", PERIOD_LABELS[data.grading_period] || data.grading_period],
        ["Submitted", data.submitted_at ? new Date(data.submitted_at).toLocaleString() : "—"],
        ["Passing grade", `${data.course?.passing_grade ?? 75}%`],
        ["Computation", weightText],
      ]} />

      {data.notes && (
        <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="font-medium">Instructor's note:</span> {data.notes}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Students", s.students],
          ["Passed", s.passed],
          ["Failed", s.failed],
          ["Class average", fmt(s.class_average)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-200 px-3 py-2">
            <p className="text-[11px] text-gray-400">{k}</p>
            <p className={`text-base font-semibold tabular-nums ${k === "Failed" && v > 0 ? "text-red-600" : "text-gray-800"}`}>{v}</p>
          </div>
        ))}
      </div>

      <Section title="Assessments included">
        {data.assessments.length === 0 ? (
          <p className="text-xs text-amber-700">No assessments are recorded for this grading period.</p>
        ) : (
          <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {data.assessments.map((a, i) => (
              <li key={i} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-700 min-w-0 truncate">
                  {a.title} <span className="text-gray-400 capitalize">· {a.type}{a.category ? ` · ${a.category}` : ""}</span>
                  {a.approval_status !== "approved" && <span className="ml-1 text-amber-600">(assessment not approved)</span>}
                </span>
                <span className="text-gray-500 shrink-0 tabular-nums">{a.students_scored} scored · avg {fmt(a.class_average)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Student grades"
        aside={data.roster.length > 8 && (
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, number, section…"
            aria-label="Search students"
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        )}>
        {data.roster.length === 0 ? (
          <p className="text-xs text-amber-700">No student scores have been uploaded for this period.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Student</th>
                  <th className="text-left font-medium px-3 py-2">Section</th>
                  <th className="text-right font-medium px-3 py-2">Assessments</th>
                  <th className="text-right font-medium px-3 py-2">Percent</th>
                  <th className="text-right font-medium px-3 py-2">Grade</th>
                  <th className="text-left font-medium px-3 py-2">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.student_ref}>
                    <td className="px-3 py-1.5 text-gray-700">
                      {r.student_name || <span className="text-gray-400">Unlinked record</span>}
                      <span className="block text-[11px] text-gray-400 font-mono">{r.student_number || `#${r.student_ref}`}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">{r.section || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.assessments_taken}/{data.assessments.length}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.percent.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">{r.grade}</td>
                    <td className={`px-3 py-1.5 font-medium ${r.passed ? "text-green-600" : "text-red-600"}`}>{r.passed ? "Passed" : "Failed"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No students match "{query}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <ApprovalTimeline history={data.history} />
    </div>
  );
}

// Full-screen review dialog. `footer` holds the Approve / Reject actions.
export function ReviewModal({ title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-800 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

// Loads a review packet and renders it with the given body component.
export function ReviewLoader({ url, Body }) {
  const { data, error, loading } = useApi(url);
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-4 bg-gray-100 rounded w-40" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  return <Body data={data} />;
}
