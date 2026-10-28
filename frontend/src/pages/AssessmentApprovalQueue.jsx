import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import Layout from "../components/Layout";
import { ReviewModal, ReviewLoader, AssessmentReviewBody } from "../components/ApprovalReview";
import { useApi } from "../hooks/useApi";
import { courseLine, PERIOD_LABELS } from "../utils/approvalReview";

const CRITERIA_LABELS = {
  content_validity: "Content is valid and relevant to learning outcomes",
  difficulty_appropriate: "Difficulty level is appropriate for the students",
  instructions_clear: "Instructions are clear and unambiguous",
  bias_free: "No cultural, gender, or socioeconomic bias detected",
  outcomes_covered: "Assessment items cover the stated course outcomes",
};

// Advisory TOS / Bloom alignment hints (capstone §3.11.2 Phase 2), shown while reviewing.
function AlignmentHints({ assessmentId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/assessments/${assessmentId}/alignment-hints`)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [assessmentId]);

  if (!data) return null;
  const warnings = data.hints.filter(h => h.severity === "warning");
  const infos = data.hints.filter(h => h.severity !== "warning");
  return (
    <section aria-labelledby={`hints-${assessmentId}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <p id={`hints-${assessmentId}`} className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        Alignment check <span className="font-normal normal-case text-gray-400">(advisory)</span>
      </p>
      {data.hints.length === 0 ? (
        <p className="text-xs text-emerald-700 mt-1">
          All {data.question_count} drafted questions match the Table of Specifications.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
          {[...warnings, ...infos].map((h, i) => (
            <li key={i} className={`text-xs ${h.severity === "warning" ? "text-amber-700" : "text-gray-500"}`}>
              {h.question_number ? <span className="font-semibold">Q{h.question_number}: </span> : null}
              {h.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApproveModal({ assessment, onClose, onDone }) {
  const [criteria, setCriteria] = useState({
    content_validity: false,
    difficulty_appropriate: false,
    instructions_clear: false,
    bias_free: false,
    outcomes_covered: false,
  });
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allCriteriaMet = Object.values(criteria).every(Boolean);

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      await api.post(`/assessments/${assessment.id}/approve`, { ...criteria, feedback: feedback || null });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.detail || "Approval failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Approve Assessment</h2>
          <p className="text-xs text-gray-500 mt-0.5">{assessment.title} &bull; {assessment.type} &bull; {assessment.grading_period}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Criteria</p>
          {Object.entries(CRITERIA_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={criteria[key]}
                onChange={e => setCriteria(c => ({ ...c, [key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className={`text-sm ${criteria[key] ? "text-gray-800" : "text-gray-500"}`}>{label}</span>
            </label>
          ))}
          {!allCriteriaMet && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              All criteria must be checked before approving.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Optional Comments</label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={2}
              placeholder="Any notes for the instructor…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !allCriteriaMet}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Approving…" : "Approve Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ assessment, onClose, onDone }) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!feedback.trim()) { setError("Feedback is required for rejection."); return; }
    setLoading(true); setError("");
    try {
      await api.post(`/assessments/${assessment.id}/reject`, { feedback });
      onDone();
    } catch (err) {
      setError(err?.response?.data?.detail || "Rejection failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Reject Assessment</h2>
          <p className="text-xs text-gray-500 mt-0.5">{assessment.title} &bull; {assessment.grading_period}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Rejection <span className="text-red-500">*</span></label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
              placeholder="Explain what needs to be revised…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !feedback.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Rejecting…" : "Reject Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssessmentCard({ assessment, onReview }) {
  const { data } = useApi(`/assessments/${assessment.id}/review`);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">{courseLine(data?.course) || " "}</p>
          <h3 className="text-sm font-semibold text-gray-800 mt-0.5">{assessment.title}</h3>
          {data?.course?.instructor_name && <p className="text-xs text-gray-500 mt-0.5">{data.course.instructor_name}</p>}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
          Pending Review
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{assessment.type}</span>
        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{PERIOD_LABELS[assessment.grading_period] || assessment.grading_period}</span>
        {data && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{data.questions.length} questions · {data.total_points} pts</span>}
      </div>
      <button
        onClick={() => onReview(assessment)}
        className="mt-4 w-full px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Review assessment
      </button>
    </div>
  );
}

export default function AssessmentApprovalQueue() {
  const [assessments, setAssessments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [reviewTarget, setReviewTarget] = useState(null);
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
      const res = await api.get("/assessments/pending-approval");
      setAssessments(res.data);
    } catch {
      showToast("Failed to load assessment queue.", "error");
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleActionDone = (action) => {
    const target = action === "approved" ? approveTarget : rejectTarget;
    setApproveTarget(null);
    setRejectTarget(null);
    setReviewTarget(null);
    setAssessments(prev => prev.filter(a => a.id !== target?.id));
    showToast(`Assessment ${action} successfully.`, action === "approved" ? "success" : "info");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assessment Approval Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review and approve instructor assessments before grade upload</p>
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
            toast.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-blue-50 text-blue-700 border border-blue-200"
          }`}>
            {toast.msg}
          </div>
        )}

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-gray-500 text-sm">No assessments pending review.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {assessments.map(a => (
              <AssessmentCard key={a.id} assessment={a} onReview={setReviewTarget} />
            ))}
          </div>
        )}

        {reviewTarget && (
          <ReviewModal
            title={reviewTarget.title}
            subtitle="Pending Program Director review"
            onClose={() => setReviewTarget(null)}
            footer={<>
              <button onClick={() => setRejectTarget(reviewTarget)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors">
                Reject
              </button>
              <button onClick={() => setApproveTarget(reviewTarget)}
                className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                Approve…
              </button>
            </>}
          >
            <div className="space-y-5">
              <AlignmentHints assessmentId={reviewTarget.id} />
              <ReviewLoader url={`/assessments/${reviewTarget.id}/review`} Body={AssessmentReviewBody} />
            </div>
          </ReviewModal>
        )}
        {approveTarget && (
          <ApproveModal
            assessment={approveTarget}
            onClose={() => setApproveTarget(null)}
            onDone={() => handleActionDone("approved")}
          />
        )}
        {rejectTarget && (
          <RejectModal
            assessment={rejectTarget}
            onClose={() => setRejectTarget(null)}
            onDone={() => handleActionDone("rejected")}
          />
        )}
      </div>
    </Layout>
  );
}
