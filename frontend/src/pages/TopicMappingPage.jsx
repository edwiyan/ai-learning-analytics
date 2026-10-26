import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import api from "../services/api";
import { useThresholds } from "../hooks/useThresholds";

const PAGE_SIZE = 15;

const PERIOD_LABEL  = { prelim:"Prelim", midterm:"Midterm", semi_final:"Semi-Final", final:"Final" };
const PERIOD_ORDER  = ["prelim","midterm","semi_final","final"];
const TYPE_LABEL    = { quiz:"Quiz", exam:"Exam", assignment:"Assignment" };
const TYPE_COLORS   = {
  quiz:       "bg-violet-50 text-violet-700 border-violet-200",
  exam:       "bg-blue-50 text-blue-700 border-blue-200",
  assignment: "bg-amber-50 text-amber-700 border-amber-200",
};

const PERIOD_THEME = {
  prelim:     { bar: "bg-blue-400",   badge: "bg-blue-50 text-blue-700 border-blue-200",     subBg: "bg-blue-50/60 border-blue-100",   label: "Prelim"     },
  midterm:    { bar: "bg-violet-400", badge: "bg-violet-50 text-violet-700 border-violet-200", subBg: "bg-violet-50/60 border-violet-100", label: "Midterm" },
  semi_final: { bar: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200",   subBg: "bg-amber-50/60 border-amber-100",   label: "Semi-Final" },
  final:      { bar: "bg-rose-400",   badge: "bg-rose-50 text-rose-700 border-rose-200",      subBg: "bg-rose-50/60 border-rose-100",     label: "Final"      },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function confZone(score, review = 0.75) {
  if (score == null) return null;
  if (score >= review) return {
    label: "High", bar: "bg-emerald-400", text: "text-emerald-700",
    borderBar: "bg-emerald-400",
    tip: "High confidence — AI strongly matched this question to the competency. Safe to approve.",
  };
  if (score >= 0.50) return {
    label: "Medium", bar: "bg-amber-400", text: "text-amber-700",
    borderBar: "bg-amber-400",
    tip: "Medium confidence — AI found a partial match. Review the question before approving.",
  };
  return {
    label: "Low", bar: "bg-red-400", text: "text-red-600",
    borderBar: "bg-red-400",
    tip: "Low confidence — AI is uncertain. Manual override is recommended.",
  };
}

// ── ConfidenceBar with tooltip ────────────────────────────────────────────────

function ConfidenceBar({ score }) {
  const T = useThresholds();
  const [tip, setTip] = useState(false);
  if (score == null) return <span className="text-xs text-gray-300">—</span>;
  const pct  = Math.round(score * 100);
  const zone = confZone(score, T.mapping_review_threshold);
  return (
    <div
      className="relative"
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      <div className="flex items-center gap-2 cursor-help min-w-[90px]">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
          <div className={`h-full rounded-full ${zone.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-semibold w-8 text-right ${zone.text}`}>{pct}%</span>
      </div>
      {tip && (
        <div className="absolute left-0 top-7 z-50 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl leading-relaxed pointer-events-none">
          <div className={`font-semibold mb-1 ${zone.text.replace("700","300").replace("600","300")}`}>
            {zone.label} Confidence ({pct}%)
          </div>
          {zone.tip}
          <div className="absolute -top-1.5 left-3 w-3 h-3 bg-gray-800 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ item }) {
  if (!item.mapped_competency_id)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />Unmapped
      </span>
    );
  if (item.validated_by)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Validated
      </span>
    );
  if (item.needs_review)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Needs Review
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />Auto-mapped
    </span>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  const borders = { gray:"border-l-gray-300", indigo:"border-l-indigo-400", amber:"border-l-amber-400", green:"border-l-emerald-400", red:"border-l-red-400" };
  const vals    = { gray:"text-gray-700", indigo:"text-indigo-600", amber:"text-amber-600", green:"text-emerald-600", red:"text-red-600" };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borders[accent]||borders.gray} p-4`}>
      <p className={`text-2xl font-bold ${vals[accent]||vals.gray}`}>{value}</p>
      <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── ConfidenceHistogram ───────────────────────────────────────────────────────

function ConfidenceHistogram({ items }) {
  const T = useThresholds();
  const mapped = items.filter(i => i.confidence_score != null);
  if (!mapped.length) return null;
  const total  = mapped.length;
  const review = T.mapping_review_threshold;
  const high   = mapped.filter(i => i.confidence_score >= review).length;
  const medium = mapped.filter(i => i.confidence_score >= 0.50 && i.confidence_score < review).length;
  const low    = mapped.filter(i => i.confidence_score < 0.50).length;
  const bars   = [
    { label: `High ≥${Math.round(review * 100)}%`,   count: high,   pct: Math.round(high/total*100),   color: "bg-emerald-400", text: "text-emerald-700" },
    { label: `Mid 50–${Math.round(review * 100)}%`,  count: medium, pct: Math.round(medium/total*100), color: "bg-amber-400",   text: "text-amber-700"   },
    { label: "Low <50%",    count: low,    pct: Math.round(low/total*100),    color: "bg-red-400",     text: "text-red-600"     },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Confidence Distribution</p>
      <div className="space-y-2.5">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-22 text-xs text-gray-500 shrink-0 w-24">{b.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${b.color} transition-all duration-500`} style={{ width: `${b.pct}%` }} />
            </div>
            <span className={`text-xs font-semibold w-16 text-right ${b.text}`}>{b.count} ({b.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UndoToast ─────────────────────────────────────────────────────────────────

function UndoToast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-gray-800 text-white text-sm px-4 py-3 rounded-xl shadow-2xl">
      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm">{message}</span>
      {onUndo && (
        <button onClick={onUndo} className="text-xs font-semibold text-indigo-300 hover:text-white underline ml-1 shrink-0">
          Undo
        </button>
      )}
      <button onClick={onDismiss} className="text-gray-400 hover:text-white ml-1 text-base leading-none">×</button>
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const fn = e => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter")  onConfirm();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onCancel, onConfirm]);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-[400]" onClick={onCancel} />
      <div className="fixed inset-0 z-[410] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</p>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── OverrideDrawer ────────────────────────────────────────────────────────────

function OverrideDrawer({ item, competencies, courseId, onCompetencyCreated, onSave, onClose }) {
  const T = useThresholds();
  const [selected, setSel]       = useState(item.mapped_competency_id || "");
  const [created, setCreated]     = useState([]);
  const [newTag, setNewTag]       = useState(null);   // { topic_name, competency_code } while the form is open
  const [tagError, setTagError]   = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const options = [...competencies, ...created.filter(c => !competencies.some(x => x.id === c.id))];
  const [saving, setSaving]       = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason]       = useState("");
  // Show the AI's original pick (kept even after earlier overrides), falling back to the live mapping.
  const aiCompId    = item.ai_suggested_competency_id || item.mapped_competency_id;
  const currentComp = competencies.find(c => c.id === aiCompId);
  const aiScore     = item.ai_confidence ?? item.confidence_score;
  const zone = confZone(aiScore, T.mapping_review_threshold);

  const doSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/assessments/items/${item.id}/tag`, null, {
        params: { competency_id: selected, reason: reason.trim() || undefined },
      });
      onSave(item.id, selected, options.find(c => c.id === selected));
    } catch { /* user can retry */ }
    finally { setSaving(false); onClose(); }
  };

  const createTag = async () => {
    if (!newTag?.topic_name?.trim()) return;
    setCreatingTag(true);
    setTagError("");
    try {
      const res = await api.post(`/syllabi/courses/${courseId}/competencies`, {
        topic_name: newTag.topic_name.trim(),
        competency_code: newTag.competency_code?.trim() || undefined,
      });
      setCreated(prev => [...prev, res.data]);
      setSel(res.data.id);
      setNewTag(null);
      onCompetencyCreated?.();
    } catch (err) {
      setTagError(err.response?.data?.detail?.toString() || "Could not create the tag.");
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSaveClick = () => {
    if (!selected) return;
    setConfirming(true);
  };

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return createPortal(
    <>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div className="fixed inset-0 bg-black/20 z-[200]" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[210] shadow-2xl flex flex-col"
        style={{ animation: "slideInRight 0.22s cubic-bezier(.4,0,.2,1)" }}
      >
        {/* Drawer header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Override Competency Mapping</h3>
            <p className="text-xs text-gray-400 mt-0.5">Manually assign the correct competency</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Question preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Question</p>
            <p className="text-sm text-gray-700 leading-relaxed">{item.question_text}</p>
          </div>

          {/* AI suggestion card */}
          {currentComp && (
            <div className="bg-indigo-50 rounded-lg px-4 py-3 border border-indigo-100">
              <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide mb-2">AI Suggestion</p>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-700">{currentComp.competency_code}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">{currentComp.topic_name}</p>
                </div>
                <ConfidenceBar score={aiScore} />
              </div>
              {zone && (
                <p className="text-xs text-indigo-400 mt-2 italic leading-relaxed">{zone.tip}</p>
              )}
            </div>
          )}

          {/* Competency selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select correct competency</label>
            <select
              value={selected}
              onChange={e => setSel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">— Choose competency —</option>
              {options.map(c => (
                <option key={c.id} value={c.id}>
                  {c.competency_code}: {c.topic_name}{c.source === "faculty" ? " (custom)" : ""}
                </option>
              ))}
            </select>
            {newTag === null && courseId && (
              <button
                type="button"
                onClick={() => { setNewTag({ topic_name: "", competency_code: "" }); setTagError(""); }}
                className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                + Create a new topic tag
              </button>
            )}
          </div>

          {newTag !== null && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">New topic tag</p>
              <p className="text-xs text-gray-500">Use this when no syllabus competency fits the question.</p>
              <label htmlFor="new-tag-topic" className="sr-only">Topic name</label>
              <input
                id="new-tag-topic"
                value={newTag.topic_name}
                onChange={e => setNewTag(t => ({ ...t, topic_name: e.target.value }))}
                maxLength={200}
                placeholder="Topic name, e.g. Recursion basics"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              <label htmlFor="new-tag-code" className="sr-only">Code (optional)</label>
              <input
                id="new-tag-code"
                value={newTag.competency_code}
                onChange={e => setNewTag(t => ({ ...t, competency_code: e.target.value }))}
                maxLength={20}
                placeholder="Code (optional, auto: FAC-01)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
              {tagError && <p role="alert" className="text-xs text-red-600">{tagError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewTag(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="button" onClick={createTag}
                  disabled={creatingTag || newTag.topic_name.trim().length < 3}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {creatingTag ? "Creating…" : "Create tag"}
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="override-reason" className="block text-xs font-medium text-gray-600 mb-1.5">
              Reason <span className="text-gray-400 font-normal">(optional, logged to improve AI mapping)</span>
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Question tests recursion, not sorting"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Drawer footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!selected || saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Override"}
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Override competency mapping?"
          message={`This will reassign the question to the selected competency and mark it as validated. This action can be reverted later.`}
          confirmLabel="Yes, Override"
          onConfirm={() => { setConfirming(false); doSave(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>,
    document.body
  );
}

// ── MappingAccuracyCard ───────────────────────────────────────────────────────
// Faculty review agreement: the AI's first suggestion vs. the faculty's final decision on
// reviewed items. Operational monitoring only — the reported mapping accuracy comes from
// the blind Mapping Validation sample (panel comment 1).

function MappingAccuracyCard({ courseId }) {
  const T = useThresholds();
  const { data: report, loading } = useApi(`/assessments/course/${courseId}/mapping-accuracy`, [courseId]);
  if (loading) return <div className="h-28 bg-gray-100 rounded-2xl animate-pulse" />;
  if (!report) return null;

  const pct = report.accuracy_pct;
  const tone = pct == null ? "text-gray-400" : report.meets_target ? "text-emerald-600" : "text-amber-600";
  const weakest = (report.by_competency || []).filter(r => r.accuracy_pct < report.target_pct).slice(0, 3);

  return (
    <section aria-labelledby="mapping-accuracy-heading" className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="mapping-accuracy-heading" className="text-sm font-semibold text-gray-800">Faculty Review Agreement</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            How often the AI's first suggestion matched your final decision, across items you reviewed.
            This is for monitoring; the reported mapping accuracy comes from the blind{" "}
            <a href="/mapping-validation" className="text-indigo-600 hover:underline">Mapping Validation</a> sample.
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${tone}`}>{pct == null ? "—" : `${pct}%`}</p>
          <p className="text-xs text-gray-500">
            {report.matched_items} of {report.reviewed_items} reviewed item{report.reviewed_items !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
        {[
          ["Accepted", report.by_action.accepted],
          ["Reassigned", report.by_action.reassigned],
          ["Custom tag", report.by_action.custom],
          ["Pending review", report.pending_review],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-lg py-2">
            <dd className="text-lg font-semibold text-gray-800">{value}</dd>
            <dt className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</dt>
          </div>
        ))}
      </dl>
      {pct == null && (
        <p className="text-xs text-gray-500 mt-3">No AI mappings have been reviewed yet. Accept or override items to measure accuracy.</p>
      )}
      {weakest.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          Lowest accuracy: {weakest.map(r => `${r.competency_code} (${r.accuracy_pct}%)`).join(", ")}
        </p>
      )}
      {report.auto_accepted_unreviewed > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {report.auto_accepted_unreviewed} auto-accepted item{report.auto_accepted_unreviewed !== 1 ? "s" : ""} (≥{Math.round(T.mapping_review_threshold * 100)}% confidence) not yet reviewed are excluded.
        </p>
      )}
    </section>
  );
}

// ── MappingTable ──────────────────────────────────────────────────────────────

function MappingTable({ assessmentId, competencies, courseId, onCompetencyCreated }) {
  const T = useThresholds();
  const { user } = useAuth();
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("all");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [drawerItem, setDrawerItem]     = useState(null);
  const [selected, setSelected]         = useState(new Set());
  const [approvingIds, setApprovingIds] = useState(new Set());
  const [toast, setToast]               = useState(null);
  const [seqMode, setSeqMode]           = useState(false);
  const [seqIndex, setSeqIndex]         = useState(0);
  const [focusedIdx, setFocusedIdx]     = useState(-1);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [confirm, setConfirm]               = useState(null);
  const confirmFn   = useRef(null);
  const sessionStart = useRef(Date.now());
  const tableRef     = useRef(null);

  const askConfirm = useCallback((title, message, confirmLabel, danger, fn) => {
    confirmFn.current = fn;
    setConfirm({ title, message, confirmLabel, danger });
  }, []);
  const onConfirmOk = useCallback(async () => {
    const fn = confirmFn.current;
    confirmFn.current = null;
    setConfirm(null);
    if (fn) await fn();
  }, []);
  const onConfirmCancel = useCallback(() => {
    confirmFn.current = null;
    setConfirm(null);
  }, []);

  useEffect(() => {
    if (!assessmentId) return;
    setLoading(true);
    setFilter("all"); setSearch(""); setPage(1);
    setSelected(new Set()); setFocusedIdx(-1); setSeqMode(false); setSeqIndex(0);
    setSessionReviewed(0); sessionStart.current = Date.now();
    api.get(`/assessments/${assessmentId}/items`)
      .then(res => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const showToast = useCallback((message, onUndo) => setToast({ message, onUndo }), []);

  // Faculty confirm, in one recorded action, every pending AI mapping at or above the
  // review threshold; low-confidence items stay in the queue.
  const [confirmingConfident, setConfirmingConfident] = useState(false);
  const confidentPending = items.filter(i => i.needs_review && !i.validated_by && i.mapped_competency_id
    && i.ai_confidence != null && i.ai_confidence >= T.mapping_review_threshold).length;
  const confirmConfident = useCallback(async () => {
    setConfirmingConfident(true);
    try {
      const res = await api.put(`/assessments/${assessmentId}/confirm-confident`);
      const fresh = await api.get(`/assessments/${assessmentId}/items`);
      setItems(Array.isArray(fresh.data) ? fresh.data : []);
      showToast(`${res.data.confirmed} mapping${res.data.confirmed === 1 ? "" : "s"} confirmed.`, null);
    } catch (err) {
      showToast(err.response?.data?.detail || "Could not confirm mappings.", null);
    } finally { setConfirmingConfident(false); }
  }, [assessmentId, showToast]);
  const dismissToast = useCallback(() => setToast(null), []);

  const handleApprove = useCallback((item) => {
    if (!item.mapped_competency_id) return;
    const comp = item.competency_code ? `${item.competency_code} — ${item.topic_name}` : "the assigned competency";
    askConfirm(
      "Approve this mapping?",
      `Confirm that this question is correctly mapped to ${comp}. You can revert this later if needed.`,
      "Approve",
      false,
      async () => {
        const snapshot = items;
        setApprovingIds(p => new Set([...p, item.id]));
        setItems(prev => prev.map(it =>
          it.id === item.id ? { ...it, needs_review: false, validated_by: user?.id, _reviewedAt: Date.now() } : it
        ));
        try {
          await api.put(`/assessments/items/${item.id}/tag?competency_id=${item.mapped_competency_id}`);
          setSessionReviewed(c => c + 1);
          showToast("Mapping approved.", () => { setItems(snapshot); dismissToast(); });
        } catch {
          setItems(snapshot);
        } finally {
          setApprovingIds(p => { const n = new Set(p); n.delete(item.id); return n; });
        }
      }
    );
  }, [items, user, askConfirm, showToast, dismissToast]);

  const handleOverrideSave = useCallback((itemId, newCompId, chosen) => {
    const comp = chosen || (competencies || []).find(c => c.id === newCompId);
    setItems(prev => prev.map(it =>
      it.id === itemId ? {
        ...it,
        mapped_competency_id: newCompId,
        competency_code: comp?.competency_code || it.competency_code,
        topic_name: comp?.topic_name || it.topic_name,
        needs_review: false,
        validated_by: user?.id,
        _reviewedAt: Date.now(),
      } : it
    ));
    setSessionReviewed(c => c + 1);
    showToast("Competency overridden.", null);
  }, [competencies, user, showToast]);

  const handleBulkApprove = useCallback(() => {
    const eligible = items.filter(it =>
      selected.has(it.id) && it.mapped_competency_id && !it.validated_by
    );
    if (!eligible.length) return;
    askConfirm(
      `Approve ${eligible.length} mapping${eligible.length > 1 ? "s" : ""}?`,
      `This will validate ${eligible.length} selected item${eligible.length > 1 ? "s" : ""} and mark them as confirmed. You can revert individual items later.`,
      "Approve All",
      false,
      async () => {
        const snapshot = items;
        setItems(prev => prev.map(it =>
          eligible.find(a => a.id === it.id)
            ? { ...it, needs_review: false, validated_by: user?.id, _reviewedAt: Date.now() }
            : it
        ));
        setSelected(new Set());
        await Promise.allSettled(
          eligible.map(it => api.put(`/assessments/items/${it.id}/tag?competency_id=${it.mapped_competency_id}`))
        );
        setSessionReviewed(c => c + eligible.length);
        showToast(
          `${eligible.length} mapping${eligible.length > 1 ? "s" : ""} approved.`,
          () => { setItems(snapshot); dismissToast(); }
        );
      }
    );
  }, [items, selected, user, askConfirm, showToast, dismissToast]);

  const handleRevert = useCallback((item) => {
    askConfirm(
      "Revert validation?",
      `This will return "${item.competency_code ? `${item.competency_code} — ${item.topic_name}` : "this question"}" to Needs Review status. The AI mapping is kept but must be re-approved.`,
      "Yes, Revert",
      true,
      async () => {
        const snapshot = items;
        setItems(prev => prev.map(it =>
          it.id === item.id ? { ...it, needs_review: true, validated_by: null, _reviewedAt: null } : it
        ));
        try {
          await api.put(`/assessments/items/${item.id}/revert`);
        } catch {
          setItems(snapshot);
        }
      }
    );
  }, [items, askConfirm]);

  const totalCount     = items.length;
  const mappedCount    = items.filter(i => i.mapped_competency_id).length;
  const needsReviewCount = items.filter(i => i.needs_review && !i.validated_by).length;
  const validatedCount = items.filter(i => i.validated_by).length;
  const unmappedCount  = items.filter(i => !i.mapped_competency_id).length;
  const mappedPct      = totalCount > 0 ? Math.round(mappedCount / totalCount * 100) : 0;

  const elapsed   = Date.now() - sessionStart.current;
  const msPerItem = sessionReviewed > 0 ? elapsed / sessionReviewed : null;
  const estMinutes = msPerItem != null && needsReviewCount > 0
    ? Math.max(1, Math.round((msPerItem * needsReviewCount) / 60000))
    : null;

  const TABS = [
    { key: "all",       label: "All",          count: totalCount },
    { key: "review",    label: "Needs Review",  count: needsReviewCount },
    { key: "validated", label: "Validated",     count: validatedCount },
    { key: "unmapped",  label: "Unmapped",      count: unmappedCount },
  ];

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "review")    list = list.filter(i => i.needs_review && !i.validated_by);
    if (filter === "validated") list = list.filter(i => i.validated_by);
    if (filter === "unmapped")  list = list.filter(i => !i.mapped_competency_id);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.question_text.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const reviewItems = useMemo(() => items.filter(i => i.needs_review && !i.validated_by), [items]);
  const paged = seqMode
    ? (reviewItems[seqIndex] ? [reviewItems[seqIndex]] : [])
    : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleKeyDown = useCallback((e) => {
    if (drawerItem) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx(i => Math.min(i + 1, paged.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setFocusedIdx(i => Math.max(i - 1, 0)); }
    if ((e.key === "a" || e.key === "A") && focusedIdx >= 0) {
      const item = paged[focusedIdx];
      if (item && item.needs_review && !item.validated_by && item.mapped_competency_id) handleApprove(item);
    }
    if ((e.key === "o" || e.key === "O") && focusedIdx >= 0) {
      const item = paged[focusedIdx];
      if (item) setDrawerItem(item);
    }
    if (e.key === "Escape") setFocusedIdx(-1);
  }, [drawerItem, paged, focusedIdx, handleApprove]);

  const allPageSelected = paged.length > 0 && paged.every(it => selected.has(it.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    allPageSelected ? paged.forEach(it => n.delete(it.id)) : paged.forEach(it => n.add(it.id));
    return n;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
        Loading items…
      </div>
    );
  }

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Items"  value={totalCount}       accent="gray"   />
        <StatCard label="Mapped"       value={mappedCount}      sub={`${mappedPct}% of items`} accent="indigo" />
        <StatCard label="Pending Confirmation" value={needsReviewCount} sub={T.mapping_auto_accept ? `Below ${Math.round(T.mapping_review_threshold * 100)}% confidence` : "every AI mapping needs faculty confirmation"} accent="amber" />
        <StatCard label="Validated"    value={validatedCount}   sub="Manually confirmed" accent="green" />
        <StatCard label="Unmapped"     value={unmappedCount}    sub="No competency assigned" accent="red" />
      </div>

      {confidentPending > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-sm text-indigo-900">
            <strong>{confidentPending}</strong> AI mapping{confidentPending === 1 ? "" : "s"} at or above {Math.round(T.mapping_review_threshold * 100)}% confidence
            {confidentPending === 1 ? " is" : " are"} waiting for confirmation. Check them in the table, then confirm them together.
          </p>
          <button onClick={confirmConfident} disabled={confirmingConfident}
            className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {confirmingConfident ? "Confirming…" : `Confirm ${confidentPending} confident mapping${confidentPending === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {/* Confidence distribution */}
      {totalCount > 0 && <ConfidenceHistogram items={items} />}

      {/* Mapping progress bar */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-500">Mapping Progress</p>
            <div className="flex items-center gap-3">
              {estMinutes != null && (
                <span className="text-xs text-gray-400">~{estMinutes} min remaining</span>
              )}
              <p className="text-xs font-semibold text-gray-700">{mappedPct}%</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
            {validatedCount > 0 && (
              <div className="bg-emerald-400 h-full rounded-l-full"
                style={{ width: `${(validatedCount / totalCount) * 100}%` }} />
            )}
            {(mappedCount - validatedCount) > 0 && (
              <div className="bg-indigo-300 h-full"
                style={{ width: `${((mappedCount - validatedCount) / totalCount) * 100}%` }} />
            )}
            {needsReviewCount > 0 && (
              <div className="bg-amber-300 h-full"
                style={{ width: `${(needsReviewCount / totalCount) * 100}%` }} />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"/>Validated</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-300 inline-block"/>Auto-mapped</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-300 inline-block"/>Needs Review</span>
          </div>
        </div>
      )}

      {/* Table card */}
      <div
        ref={tableRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Question Mappings</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {seqMode
                  ? `Reviewing item ${seqIndex + 1} of ${reviewItems.length}`
                  : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}${
                      filter !== "all" ? ` · filtered by ${TABS.find(t => t.key === filter)?.label}` : ""
                    }${search ? ` · matching "${search}"` : ""}`
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {needsReviewCount > 0 && (
                <button
                  onClick={() => { setSeqMode(m => !m); setSeqIndex(0); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    seqMode
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100"
                  }`}
                >
                  {seqMode ? "Exit Review Mode" : `Review Mode (${needsReviewCount})`}
                </button>
              )}
              {!seqMode && (
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search questions…"
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
                  />
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            {T.mapping_auto_accept
              ? <>Items below <strong className="text-amber-600">{Math.round(T.mapping_review_threshold * 100)}% confidence</strong> require manual review.</>
              : <>Every AI mapping needs your confirmation; items below <strong className="text-amber-600">{Math.round(T.mapping_review_threshold * 100)}% confidence</strong> are listed first. The AI's confidence is self-reported and is not proof of correctness.</>}
            Focus a row then press{" "}
            <kbd className="bg-gray-100 border border-gray-200 px-1 py-0.5 rounded text-gray-600 font-mono text-[10px]">A</kbd> to approve,{" "}
            <kbd className="bg-gray-100 border border-gray-200 px-1 py-0.5 rounded text-gray-600 font-mono text-[10px]">O</kbd> to override.
          </p>

          {!seqMode && (
            <div className="flex flex-wrap gap-1.5">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filter === tab.key
                      ? tab.key === "review"    ? "bg-amber-600 text-white border-amber-600"
                      : tab.key === "validated" ? "bg-emerald-600 text-white border-emerald-600"
                      : tab.key === "unmapped"  ? "bg-red-500 text-white border-red-500"
                      : "bg-gray-700 text-white border-gray-700"
                      : tab.key === "review"    ? "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                      : tab.key === "validated" ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                      : tab.key === "unmapped"  ? "text-red-600 bg-red-50 border-red-200 hover:bg-red-100"
                      : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          )}

          {seqMode && reviewItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSeqIndex(i => Math.max(0, i - 1))}
                disabled={seqIndex === 0}
                className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >← Previous</button>
              <span className="text-xs text-gray-400 font-medium">{seqIndex + 1} / {reviewItems.length}</span>
              <button
                onClick={() => setSeqIndex(i => Math.min(reviewItems.length - 1, i + 1))}
                disabled={seqIndex === reviewItems.length - 1}
                className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >Next →</button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p className="text-sm text-gray-500">No items found</p>
            <p className="text-xs text-gray-400 mt-1">Upload a CSV to this assessment to generate mappings</p>
          </div>
        ) : seqMode && reviewItems.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-emerald-600 font-medium">All Needs Review items have been handled.</p>
            <button onClick={() => setSeqMode(false)} className="text-xs text-indigo-600 underline mt-1">
              Exit review mode
            </button>
          </div>
        ) : filtered.length === 0 && !seqMode ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No items match the current filter{search ? ` and search "${search}"` : ""}.
            <p className="text-xs mt-1 text-gray-300">
              {filter === "review"    ? "All items have been reviewed — great work!" :
               filter === "validated" ? "No items have been validated yet." :
               filter === "unmapped"  ? "All items have a competency assigned." : ""}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                  <th className="w-1 p-0" />
                  {!seqMode && (
                    <th className="pl-3 pr-2 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Question</th>
                  <th className="px-4 py-3 text-left w-52">Mapped Competency</th>
                  <th className="px-4 py-3 text-left w-32">Bloom's Level</th>
                  <th className="px-4 py-3 text-left w-36">Confidence</th>
                  <th className="px-4 py-3 text-left w-32">Status</th>
                  <th className="px-4 py-3 text-left w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map((item, idx) => {
                  const zone       = confZone(item.confidence_score, T.mapping_review_threshold);
                  const isFocused  = focusedIdx === idx;
                  const isSelected = selected.has(item.id);
                  const rowBg      =
                    isFocused         ? "bg-indigo-50"      :
                    item.validated_by ? "bg-emerald-50/30"  :
                    item.needs_review ? "bg-amber-50/40"    :
                    isSelected        ? "bg-indigo-50/40"   :
                    "hover:bg-gray-50/80";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setFocusedIdx(idx)}
                      className={`transition-colors cursor-pointer ${rowBg} ${isFocused ? "ring-1 ring-inset ring-indigo-200" : ""}`}
                    >
                      <td className="p-0 w-1">
                        <div
                          className={`w-1 ${zone ? zone.borderBar : "bg-gray-100"}`}
                          style={{ minHeight: "52px", height: "100%" }}
                        />
                      </td>

                      {!seqMode && (
                        <td className="pl-3 pr-2 py-3.5" onClick={e => e.stopPropagation()}>
                          {item.validated_by ? (
                            <span className="w-4 h-4 inline-flex items-center justify-center text-emerald-400" title="Validated — cannot be bulk-selected">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                              </svg>
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setSelected(prev => {
                                const n = new Set(prev);
                                n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                                return n;
                              })}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                            />
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {seqMode ? seqIndex + 1 : (page - 1) * PAGE_SIZE + idx + 1}
                      </td>

                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="text-gray-700 line-clamp-2 text-sm leading-relaxed">{item.question_text}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.competency_code ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {item.competency_code}
                            </span>
                            <p className="text-xs text-gray-500 mt-1 leading-tight">{item.topic_name}</p>
                            {item._reviewedAt && (
                              <p className="text-xs text-gray-300 mt-0.5">
                                Reviewed {Math.max(0, Math.round((Date.now() - item._reviewedAt) / 60000))}m ago
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Not assigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {item.bloom_level ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            {Remembering:"bg-blue-50 text-blue-700 border-blue-200",
                             Understanding:"bg-teal-50 text-teal-700 border-teal-200",
                             Applying:"bg-green-50 text-green-700 border-green-200",
                             Analyzing:"bg-amber-50 text-amber-700 border-amber-200",
                             Evaluating:"bg-orange-50 text-orange-700 border-orange-200",
                             Creating:"bg-purple-50 text-purple-700 border-purple-200"}[item.bloom_level] || "bg-gray-50 text-gray-500 border-gray-200"
                          }`}>{item.bloom_level}</span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>

                      <td className="px-4 py-3.5">
                        <ConfidenceBar score={item.confidence_score} />
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge item={item} />
                      </td>

                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.validated_by ? (
                            <>
                              <button
                                onClick={() => handleRevert(item)}
                                className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Revert
                              </button>
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Override
                              </button>
                            </>
                          ) : (
                            <>
                              {item.needs_review && item.mapped_competency_id && (
                                <button
                                  onClick={() => handleApprove(item)}
                                  disabled={approvingIds.has(item.id)}
                                  className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {approvingIds.has(item.id) ? "…" : "Approve"}
                                </button>
                              )}
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Override
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!seqMode && (
              <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
            )}
          </div>
        )}
      </div>

      {/* Bulk floating toolbar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl">
          <span className="text-xs text-gray-300 font-medium">{selected.size} selected</span>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={handleBulkApprove}
            className="text-xs font-semibold text-emerald-300 hover:text-emerald-100 transition-colors"
          >
            Approve Eligible
          </button>
          <div className="w-px h-4 bg-gray-600" />
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {drawerItem && (
        <OverrideDrawer
          item={drawerItem}
          competencies={competencies || []}
          courseId={courseId}
          onCompetencyCreated={onCompetencyCreated}
          onSave={handleOverrideSave}
          onClose={() => setDrawerItem(null)}
        />
      )}

      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={toast.onUndo}
          onDismiss={dismissToast}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={onConfirmOk}
          onCancel={onConfirmCancel}
        />
      )}
    </>
  );
}

// ── TopicMappingPage ──────────────────────────────────────────────────────────

export default function TopicMappingPage() {
  const T = useThresholds();
  const { data: courses, loading: coursesLoading } = useApi("/courses/");
  const [selectedCourseId, setSelectedCourseId]         = useState(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

  const { data: assessments, loading: assessmentsLoading } = useApi(
    selectedCourseId ? `/assessments/course/${selectedCourseId}` : null,
    [selectedCourseId]
  );
  const { data: competencies, refetch: refetchCompetencies } = useApi(
    selectedCourseId ? `/syllabi/courses/${selectedCourseId}/competencies` : null,
    [selectedCourseId]
  );

  useEffect(() => { setSelectedAssessmentId(null); }, [selectedCourseId]);

  const selectedCourse     = (courses || []).find(c => c.id === selectedCourseId);
  const selectedAssessment = (assessments || []).find(a => a.id === selectedAssessmentId);

  const assessmentsByPeriod = useMemo(() => {
    const grouped = {};
    PERIOD_ORDER.forEach(p => { grouped[p] = []; });
    (assessments || []).forEach(a => {
      if (grouped[a.grading_period]) grouped[a.grading_period].push(a);
    });
    return grouped;
  }, [assessments]);

  const activePeriods = PERIOD_ORDER.filter(p => assessmentsByPeriod[p]?.length > 0);

  // ── Landing view ──────────────────────────────────────────────────────────
  const LandingView = (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold text-gray-900">Topic Mapping</h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              AI-Powered
            </span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xl">
            Each assessment question is automatically mapped to a course competency using NLP.
            {T.mapping_auto_accept
              ? <>Items below <strong className="text-amber-600 font-semibold">{Math.round(T.mapping_review_threshold * 100)}% confidence</strong> are flagged for your review.</>
              : <>AI mappings are applied provisionally and each one waits for your confirmation; items below <strong className="text-amber-600 font-semibold">{Math.round(T.mapping_review_threshold * 100)}% confidence</strong> are listed first.</>}
          </p>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative">
          {[
            {
              step: "1", title: "Upload CSV", color: "text-blue-600 bg-blue-50",
              desc: "Upload your assessment scores CSV file for each assessment.",
              icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
            },
            {
              step: "2", title: "AI Maps", color: "text-violet-600 bg-violet-50",
              desc: "GPT-4o-mini reads each question and assigns the best-matching competency.",
              icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
            },
            {
              step: "3", title: "Review", color: "text-amber-600 bg-amber-50",
              desc: "You verify low-confidence mappings and override any incorrect assignments.",
              icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
            },
            {
              step: "4", title: "Validated", color: "text-emerald-600 bg-emerald-50",
              desc: "Confirmed mappings feed the risk classification, analytics, and student dashboards.",
              icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0",
            },
          ].map((s, i, arr) => (
            <div key={s.step} className="relative flex flex-col">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color} mb-4 shrink-0`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon}/>
                </svg>
              </div>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Step {s.step}</p>
              <p className="text-sm font-bold text-gray-800 mb-1.5">{s.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              {i < arr.length - 1 && (
                <div className="hidden sm:block absolute top-5 -right-3 text-gray-200 text-xl select-none">›</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Course cards */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Select a Course to Begin</p>
        {coursesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse"/>)}
          </div>
        ) : (courses || []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
            <p className="text-sm text-gray-400">No courses assigned to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(courses || []).map(course => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className="group text-left bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                    {course.code}
                  </span>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors">
                  {course.title}
                </p>
                {course.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{course.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Course detail view ────────────────────────────────────────────────────
  const CourseView = selectedCourseId && (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + heading */}
      <div>
        <button
          onClick={() => { setSelectedCourseId(null); setSelectedAssessmentId(null); }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          All Courses
        </button>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
            {selectedCourse?.code}
          </span>
          <h2 className="text-xl font-bold text-gray-900">{selectedCourse?.title}</h2>
        </div>
        <p className="text-sm text-gray-400">
          Select an assessment below to open its topic mapping review.
        </p>
      </div>

      <MappingAccuracyCard courseId={selectedCourseId} />

      {/* Assessments by period */}
      {assessmentsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse"/>)}
        </div>
      ) : (assessments || []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p className="text-sm text-gray-400">No assessments yet for this course.</p>
          <p className="text-xs text-gray-300 mt-1">Create an assessment and upload a CSV to begin.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activePeriods.map(period => {
            const theme = PERIOD_THEME[period];
            return (
              <div key={period}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-1 h-5 rounded-full ${theme.bar}`} />
                  <p className="text-sm font-bold text-gray-700">{theme.label}</p>
                  <span className="text-xs text-gray-400">
                    {assessmentsByPeriod[period].length} assessment{assessmentsByPeriod[period].length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assessmentsByPeriod[period].map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssessmentId(a.id)}
                      className="group relative text-left bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all duration-200"
                    >
                      <div className={`absolute left-0 inset-y-0 w-1 ${theme.bar}`} />
                      <div className="pl-5 pr-4 py-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[a.type] || ""}`}>
                            {TYPE_LABEL[a.type] || a.type}
                          </span>
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2">
                          {a.title}
                        </p>
                        {a.date && (
                          <p className="text-xs text-gray-400 mt-1.5">
                            {new Date(a.date).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Layout>
        <div className="py-2">
          {selectedCourseId ? CourseView : LandingView}
        </div>
      </Layout>

      {/* Full-screen mapping modal — outside Layout so it covers the sidebar */}
      {selectedAssessmentId && selectedAssessment && (() => {
        const theme = PERIOD_THEME[selectedAssessment.grading_period] || PERIOD_THEME.prelim;
        return (
          <>
            <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div
              className="fixed inset-0 z-[50] bg-gray-50 flex flex-col"
              style={{ animation: "fadeUp 0.2s ease-out" }}
            >
              {/* Modal header — top bar */}
              <div className="bg-white border-b border-gray-200 shrink-0">
                <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedAssessmentId(null)}
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                      </svg>
                      Back
                    </button>
                    <span className="text-gray-200 select-none text-lg">/</span>
                    <span className="text-xs text-gray-400 truncate hidden sm:block">{selectedCourse?.title}</span>
                    <span className="text-gray-200 hidden sm:block select-none">·</span>
                    <span className="text-sm font-semibold text-gray-800 truncate">{selectedAssessment.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                      AI-assisted
                    </div>
                    <button
                      onClick={() => setSelectedAssessmentId(null)}
                      className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Sub-bar: period + type + date */}
                <div className={`px-6 py-2 flex items-center gap-3 border-t ${theme.subBg}`}>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${theme.badge}`}>
                    {theme.label}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[selectedAssessment.type] || ""}`}>
                    {TYPE_LABEL[selectedAssessment.type] || selectedAssessment.type}
                  </span>
                  {selectedAssessment.date && (
                    <span className="text-xs text-gray-400">
                      {new Date(selectedAssessment.date).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Modal body — scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                  <MappingTable
                    key={selectedAssessmentId}
                    assessmentId={selectedAssessmentId}
                    competencies={competencies || []}
                    courseId={selectedCourseId}
                    onCompetencyCreated={refetchCompetencies}
                  />
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}
