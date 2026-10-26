import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import Layout from "../components/Layout";

const PERIOD_LABELS = {
  prelim: "Prelim",
  midterm: "Midterm",
  semi_final: "Semi-Final",
  final: "Final",
};

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  pending_pd: "bg-amber-100 text-amber-700",
  pending_dean: "bg-amber-100 text-amber-700",
  pending_vp: "bg-amber-100 text-amber-700",
  posted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending_pd: "Pending PD",
  pending_dean: "Pending Dean",
  pending_vp: "Pending VP",
  posted: "Posted",
  rejected: "Rejected",
};

const CHAIN_NODES = [
  { key: "pending_pd", label: "PD" },
  { key: "pending_dean", label: "Dean" },
  { key: "pending_vp", label: "VP" },
  { key: "posted", label: "Posted" },
];
const STAGE_ORDER = ["draft", "pending_pd", "pending_dean", "pending_vp", "posted"];

function ApprovalChain({ status }) {
  const currentIdx = STAGE_ORDER.indexOf(status);
  const rejected = status === "rejected";
  return (
    <div className="flex items-center gap-1 mt-2">
      {CHAIN_NODES.map((node, i) => {
        const nodeIdx = STAGE_ORDER.indexOf(node.key);
        const done = !rejected && currentIdx > nodeIdx;
        const active = !rejected && currentIdx === nodeIdx;
        return (
          <div key={node.key} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              done ? "bg-green-500 border-green-500 text-white" :
              active ? "bg-amber-400 border-amber-400 text-white" :
              "bg-gray-100 border-gray-300 text-gray-400"
            }`}>
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : node.label[0]}
            </div>
            {i < CHAIN_NODES.length - 1 && <div className={`w-5 h-0.5 ${done ? "bg-green-400" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ConfirmModal({ submission, course, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Confirm Grade Submission</h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">You are about to submit the following grade submission for PD review:</p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Course</span><span className="font-medium">{course?.title || course?.code}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Period</span><span className="font-medium">{PERIOD_LABELS[submission?.grading_period] || submission?.grading_period}</span></div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Once submitted, you cannot withdraw the submission until it is reviewed.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Submitting…" : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GradeSubmissionPage() {
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({ course_id: "", grading_period: "prelim", notes: "" });
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [coursesRes, subsRes] = await Promise.all([
        api.get("/courses/"),
        api.get("/grade-submissions/mine"),
      ]);
      setCourses(coursesRes.data);
      setSubmissions(subsRes.data);
      if (coursesRes.data.length > 0 && !form.course_id) {
        setForm(f => ({ ...f, course_id: coursesRes.data[0].id }));
      }
    } catch {
      showToast("Failed to load data.", "error");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openConfirm = (e) => {
    e.preventDefault();
    if (!form.course_id) { setError("Please select a course."); return; }
    setError("");
    setConfirmTarget({
      _isNew: true,
      grading_period: form.grading_period,
      notes: form.notes,
      _course: courseMap[form.course_id],
    });
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    setActionLoading(true);
    try {
      if (confirmTarget._isNew) {
        const createRes = await api.post("/grade-submissions/", {
          course_id: form.course_id,
          grading_period: form.grading_period,
          notes: form.notes || null,
        });
        const submitRes = await api.post(`/grade-submissions/${createRes.data.id}/submit-to-pd`);
        setSubmissions(prev => [submitRes.data, ...prev]);
        setForm(f => ({ ...f, notes: "" }));
      } else {
        const res = await api.post(`/grade-submissions/${confirmTarget.id}/submit-to-pd`);
        setSubmissions(prev => prev.map(s => s.id === confirmTarget.id ? res.data : s));
      }
      setConfirmTarget(null);
      showToast("Submitted to Program Director for review.");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Submit failed.", "error");
    } finally { setActionLoading(false); }
  };

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Grade Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit grading period results for PD → Dean → VP approval before official posting.</p>
        </div>

        {toast && (
          <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
            toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
            "bg-red-50 text-red-700 border border-red-200"
          }`}>{toast.msg}</div>
        )}

        {/* Create form */}
        <form onSubmit={openConfirm} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">New Grade Submission</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Course</label>
              <select value={form.course_id} onChange={e => setForm(f => ({ ...f, course_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grading Period</label>
              <select value={form.grading_period} onChange={e => setForm(f => ({ ...f, grading_period: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(PERIOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Any notes for the reviewing officials…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={!form.course_id}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            Create Submission
          </button>
        </form>

        {/* Submissions list */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">My Submissions</h2>
          {fetching ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">No grade submissions yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {submissions.map(sub => {
                const course = courseMap[sub.course_id];
                return (
                  <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-400">{course?.code || "—"}</p>
                        <p className="text-sm font-semibold text-gray-800">{course?.title || sub.course_id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{PERIOD_LABELS[sub.grading_period] || sub.grading_period}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[sub.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[sub.status] || sub.status}
                      </span>
                    </div>
                    {sub.notes && <p className="text-xs text-gray-500 mt-2 italic">"{sub.notes}"</p>}
                    <ApprovalChain status={sub.status} />
                    {sub.status === "rejected" && (
                      <div className="mt-3">
                        <button onClick={() => setConfirmTarget({ ...sub, _course: course })}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                          Resubmit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmTarget && (
        <ConfirmModal
          submission={confirmTarget}
          course={confirmTarget._course}
          onConfirm={handleConfirm}
          onClose={() => setConfirmTarget(null)}
          loading={actionLoading}
        />
      )}
    </Layout>
  );
}
