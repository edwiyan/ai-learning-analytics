import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import Layout from "../components/Layout";

const PERIOD_LABELS = {
  prelim: "Prelim", midterm: "Midterm", semi_final: "Semi-Final", final: "Final",
};

function ApproveModal({ submission, onClose, onDone }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      await api.post(`/grade-submissions/${submission.id}/approve`, { feedback: feedback || null });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.detail || "Approval failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Approve Grade Submission</h2>
          <p className="text-xs text-gray-500 mt-0.5">{PERIOD_LABELS[submission.grading_period] || submission.grading_period}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Optional Comments</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
              placeholder="Any notes for the next approver or instructor…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ submission, onClose, onDone }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!feedback.trim()) { setError("Feedback is required for rejection."); return; }
    setLoading(true); setError("");
    try {
      await api.post(`/grade-submissions/${submission.id}/reject`, { feedback });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.detail || "Rejection failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Reject Grade Submission</h2>
          <p className="text-xs text-gray-500 mt-0.5">{PERIOD_LABELS[submission.grading_period] || submission.grading_period}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4}
              placeholder="Explain what needs to be revised…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !feedback.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmissionCard({ submission, onApprove, onReject }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 font-mono">#{String(submission.id).slice(0, 8)}</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">
            {PERIOD_LABELS[submission.grading_period] || submission.grading_period} Grades
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Submitted: {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "—"}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">Pending Review</span>
      </div>
      {submission.notes && <p className="text-xs text-gray-500 mt-2 italic">"{submission.notes}"</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => onApprove(submission)}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Approve
        </button>
        <button onClick={() => onReject(submission)}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
          Reject
        </button>
      </div>
    </div>
  );
}

export default function GradeApprovalQueue() {
  const [submissions, setSubmissions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQueue = useCallback(async () => {
    setFetching(true);
    try {
      const res = await api.get("/grade-submissions/pending");
      setSubmissions(res.data);
    } catch {
      showToast("Failed to load grade submission queue.", "error");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleDone = (action, target) => {
    setApproveTarget(null);
    setRejectTarget(null);
    setSubmissions(prev => prev.filter(s => s.id !== target.id));
    showToast(`Grade submission ${action} successfully.`, action === "approved" ? "success" : "info");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Grade Approval Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review grade submissions from instructors</p>
          </div>
          <button onClick={fetchQueue} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium ${
            toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
            toast.type === "info" ? "bg-blue-50 text-blue-700 border border-blue-200" :
            "bg-red-50 text-red-700 border border-red-200"
          }`}>{toast.msg}</div>
        )}

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No grade submissions pending review.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {submissions.map(s => (
              <SubmissionCard key={s.id} submission={s} onApprove={setApproveTarget} onReject={setRejectTarget} />
            ))}
          </div>
        )}

        {approveTarget && (
          <ApproveModal
            submission={approveTarget}
            onClose={() => setApproveTarget(null)}
            onDone={() => handleDone("approved", approveTarget)}
          />
        )}
        {rejectTarget && (
          <RejectModal
            submission={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onDone={() => handleDone("rejected", rejectTarget)}
          />
        )}
      </div>
    </Layout>
  );
}
