import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useApi } from "../hooks/useApi";
import api from "../services/api";

const ACADEMIC_STATUSES = [
  { value: "passed",     label: "Passed",     color: "border-green-500 bg-green-50",  text: "text-green-700" },
  { value: "failed",     label: "Failed",     color: "border-red-500 bg-red-50",      text: "text-red-700" },
  { value: "incomplete", label: "Incomplete", color: "border-amber-500 bg-amber-50",  text: "text-amber-700" },
  { value: "dropped",    label: "Dropped",    color: "border-gray-400 bg-gray-50",    text: "text-gray-600" },
];

const ADVISING_TYPES = [
  { value: "remediation",        label: "Remediation Support" },
  { value: "enrichment",         label: "Enrichment Program" },
  { value: "counseling_referral",label: "Counseling Referral" },
  { value: "retake_guidance",    label: "Retake Guidance" },
  { value: "no_action_needed",   label: "No Action Needed" },
];

const ADVISING_LABELS = {
  remediation:         "Remediation Support",
  enrichment:          "Enrichment Program",
  counseling_referral: "Counseling Referral",
  retake_guidance:     "Retake Guidance",
  no_action_needed:    "No Action Needed",
};

const STATUS_BADGE = {
  passed:     "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
  incomplete: "bg-amber-100 text-amber-700",
  dropped:    "bg-gray-100 text-gray-600",
};

const PERIODS = [
  { value: "prelim",     label: "Prelim" },
  { value: "midterm",    label: "Midterm" },
  { value: "semi_final", label: "Semi-Final" },
  { value: "final",      label: "Final" },
];

function ConsultationCard({ c }) {
  const status = c.academic_status;
  return (
    <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {status && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
          {c.grading_period && (
            <span className="text-xs text-gray-400 font-medium">
              {c.grading_period.replace("_", " ").replace(/\b\w/g, s => s.toUpperCase())}
            </span>
          )}
          <span className="text-xs text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</span>
        </div>
        {c.notes && <p className="text-sm text-gray-700 mb-1">{c.notes}</p>}
        {c.next_steps && <p className="text-xs text-indigo-600 mt-1">Next: {c.next_steps}</p>}
        {status === "incomplete" && c.completion_deadline && (
          <p className={`text-xs mt-1 font-medium ${new Date(c.completion_deadline) < new Date() ? "text-red-600" : "text-amber-600"}`}>
            INC deadline: {c.completion_deadline}
            {new Date(c.completion_deadline) < new Date() ? " (OVERDUE)" : ""}
          </p>
        )}
        {status === "incomplete" && c.incomplete_reason && (
          <p className="text-xs text-gray-500 mt-0.5">Reason: {c.incomplete_reason}</p>
        )}
        {c.advising_type && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {ADVISING_LABELS[c.advising_type] ?? c.advising_type}
            </span>
            {c.advising_content && <p className="text-xs text-gray-600 mt-1">{c.advising_content}</p>}
            {c.retake_recommended && (
              <p className="text-xs text-red-600 font-medium mt-0.5">Retake recommended{c.retake_notes ? `: ${c.retake_notes}` : ""}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GradeConsultationPage() {
  const { data: courses, loading: loadingCourses } = useApi("/analytics/instructor/course-summaries");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: students } = useApi(
    selectedCourseId ? `/analytics/courses/${selectedCourseId}/students?limit=200` : null,
    [selectedCourseId]
  );

  const [consultations, setConsultations] = useState([]);
  const [loadingConsult, setLoadingConsult] = useState(false);

  const loadConsultations = async (courseId, hash) => {
    if (!courseId || !hash) return;
    setLoadingConsult(true);
    try {
      const res = await api.get(`/analytics/courses/${courseId}/consultations?student_id_hash=${hash}`);
      setConsultations(res.data);
    } catch {
      setConsultations([]);
    } finally {
      setLoadingConsult(false);
    }
  };

  useEffect(() => {
    if (selectedCourseId && selectedStudent) {
      loadConsultations(selectedCourseId, selectedStudent.student_id_hash);
    } else {
      setConsultations([]);
    }
  }, [selectedCourseId, selectedStudent]);

  // Form state
  const [form, setForm] = useState({
    grading_period: "prelim",
    conducted_at: new Date().toISOString().slice(0, 10),
    academic_status: "",
    notes: "",
    next_steps: "",
    incomplete_reason: "",
    completion_deadline: "",
    advising_type: "",
    advising_content: "",
    retake_recommended: false,
    retake_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedCourseId || !selectedStudent || !form.academic_status) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const showAdvising = form.academic_status === "failed" || form.academic_status === "dropped";
      await api.post(`/analytics/courses/${selectedCourseId}/consultations`, {
        student_id_hash: selectedStudent.student_id_hash,
        grading_period: form.grading_period,
        conducted_at: form.conducted_at ? new Date(form.conducted_at).toISOString() : null,
        academic_status: form.academic_status,
        notes: form.notes || null,
        next_steps: form.next_steps || null,
        incomplete_reason: form.academic_status === "incomplete" ? (form.incomplete_reason || null) : null,
        completion_deadline: form.academic_status === "incomplete" ? (form.completion_deadline || null) : null,
        advising_type: showAdvising ? (form.advising_type || null) : null,
        advising_content: showAdvising ? (form.advising_content || null) : null,
        retake_recommended: showAdvising ? form.retake_recommended : false,
        retake_notes: showAdvising && form.retake_recommended ? (form.retake_notes || null) : null,
      });
      setSaved(true);
      setForm(f => ({ ...f, notes: "", next_steps: "", incomplete_reason: "", completion_deadline: "", advising_type: "", advising_content: "", retake_recommended: false, retake_notes: "" }));
      await loadConsultations(selectedCourseId, selectedStudent.student_id_hash);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save consultation");
    } finally {
      setSaving(false);
    }
  };

  const studentList = students?.data ?? [];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Grade Consultation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Log academic status and consultation notes per student per grading period</p>
        </div>

        {/* Course + Student selectors */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Course</label>
            <select
              value={selectedCourseId}
              onChange={e => { setSelectedCourseId(e.target.value); setSelectedStudent(null); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select a course —</option>
              {(courses ?? []).map(c => (
                <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_title}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Student</label>
            <select
              value={selectedStudent?.student_id_hash ?? ""}
              onChange={e => setSelectedStudent(studentList.find(s => s.student_id_hash === e.target.value) ?? null)}
              disabled={!selectedCourseId}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">— Select a student —</option>
              {studentList.map(s => (
                <option key={s.student_id_hash} value={s.student_id_hash}>
                  {s.full_name} {s.student_number ? `(${s.student_number})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCourseId && selectedStudent ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Consultation form */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">New Consultation — {selectedStudent.full_name}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Grading Period</label>
                    <select value={form.grading_period} onChange={e => setForm(f => ({ ...f, grading_period: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Conducted On</label>
                    <input type="date" value={form.conducted_at}
                      onChange={e => setForm(f => ({ ...f, conducted_at: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Academic Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACADEMIC_STATUSES.map(s => (
                      <label key={s.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.academic_status === s.value ? s.color : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input type="radio" name="academic_status" value={s.value}
                          checked={form.academic_status === s.value}
                          onChange={e => setForm(f => ({ ...f, academic_status: e.target.value }))}
                          className="sr-only" />
                        <span className={`text-sm font-semibold ${form.academic_status === s.value ? s.text : "text-gray-700"}`}>
                          {s.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Consultation notes…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Next Steps</label>
                  <input type="text" value={form.next_steps} onChange={e => setForm(f => ({ ...f, next_steps: e.target.value }))}
                    placeholder="Recommended action for student…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {/* T5-B: Incomplete fields */}
                {form.academic_status === "incomplete" && (
                  <div className="space-y-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700">Incomplete Grade Details</p>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Reason for Incomplete</label>
                      <input type="text" value={form.incomplete_reason} onChange={e => setForm(f => ({ ...f, incomplete_reason: e.target.value }))}
                        placeholder="e.g. Medical leave, missed final exam"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Completion Deadline</label>
                      <input type="date" value={form.completion_deadline} onChange={e => setForm(f => ({ ...f, completion_deadline: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                  </div>
                )}

                {/* T5-C: Post-grade advising (failed / dropped only) */}
                {(form.academic_status === "failed" || form.academic_status === "dropped") && (
                  <div className="space-y-3 bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700">Post-Grade Advising</p>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Advising Type</label>
                      <select value={form.advising_type} onChange={e => setForm(f => ({ ...f, advising_type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">— None —</option>
                        {ADVISING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Advising Notes</label>
                      <textarea value={form.advising_content} onChange={e => setForm(f => ({ ...f, advising_content: e.target.value }))}
                        rows={2} placeholder="Details of advising session…"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.retake_recommended}
                        onChange={e => setForm(f => ({ ...f, retake_recommended: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Recommend retake</span>
                    </label>
                    {form.retake_recommended && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Retake Notes</label>
                        <input type="text" value={form.retake_notes} onChange={e => setForm(f => ({ ...f, retake_notes: e.target.value }))}
                          placeholder="e.g. Must complete missing requirements first"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                      </div>
                    )}
                  </div>
                )}

                {error && <p className="text-xs text-red-600">{error}</p>}
                {saved && <p className="text-xs text-green-600">Consultation saved!</p>}

                <button type="submit" disabled={saving || !form.academic_status}
                  className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                  {saving ? "Saving…" : "Save Consultation"}
                </button>
              </form>
            </div>

            {/* Consultation history */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">History — {selectedStudent.full_name}</h2>
              {loadingConsult ? (
                <div className="space-y-2 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">No consultations yet for this student.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {consultations.map(c => <ConsultationCard key={c.id} c={c} />)}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl py-16 text-center text-sm text-gray-400">
            Select a course and student to log a grade consultation.
          </div>
        )}
      </div>
    </Layout>
  );
}
