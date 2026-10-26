import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "../components/Layout";
import { useApi } from "../hooks/useApi";
import api from "../services/api";

// ─── UI Sub-components ────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === "success" ? "bg-green-600" : "bg-red-600";
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 ${bg} text-white px-4 py-3 rounded-xl shadow-lg`}>
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-1 text-white/80 hover:text-white transition-colors leading-none">&times;</button>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const confirmCls = danger
    ? "bg-red-600 hover:bg-red-700 text-white transition-colors"
    : "bg-indigo-600 hover:bg-indigo-700 text-white transition-colors";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white max-w-sm w-full mx-4 rounded-xl shadow-xl p-6">
        <p className="text-base font-semibold text-gray-800">{title}</p>
        {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm font-medium ${confirmCls}`}>
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TYPE_CONFIG = {
  video: {
    label: "Video", bg: "bg-purple-100", text: "text-purple-700",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  reading: {
    label: "Reading", bg: "bg-amber-100", text: "text-amber-700",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  exercise: {
    label: "Exercise", bg: "bg-green-100", text: "text-green-700",
    icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  },
};

function TypeBadge({ type }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {config.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 animate-pulse">
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-1/3 mt-2" />
      </div>
      <div className="w-7 h-7 bg-gray-100 rounded-lg shrink-0" />
    </div>
  );
}

function StatSummary({ resources }) {
  if (!resources?.length) return null;
  const total     = resources.length;
  const videos    = resources.filter(r => r.type === "video").length;
  const readings  = resources.filter(r => r.type === "reading").length;
  const exercises = resources.filter(r => r.type === "exercise").length;
  const N = ({ n }) => <span className="font-medium text-gray-700">{n}</span>;
  return (
    <div className="flex gap-4 text-xs text-gray-500 flex-wrap mt-1">
      <span><N n={total} /> resources</span>
      <span>&middot;</span>
      <span><N n={videos} /> videos</span>
      <span>&middot;</span>
      <span><N n={readings} /> readings</span>
      <span>&middot;</span>
      <span><N n={exercises} /> exercises</span>
    </div>
  );
}

function TagInput({ value, onChange, placeholder }) {
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  function addTag(raw) {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag].join(", "));
  }

  function removeTag(index) {
    onChange(tags.filter((_, i) => i !== index).join(", "));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputVal);
      setInputVal("");
    } else if (e.key === "Backspace" && inputVal === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    if (val.endsWith(",")) { addTag(val.slice(0, -1)); setInputVal(""); }
    else setInputVal(val);
  }

  return (
    <div
      className="flex flex-wrap gap-1 items-center border border-gray-300 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 min-h-[42px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-medium px-2 py-0.5 rounded-full">
          {tag}
          <button type="button" onClick={e => { e.stopPropagation(); removeTag(i); }}
            className="text-indigo-400 hover:text-indigo-600 transition-colors leading-none">&times;</button>
        </span>
      ))}
      <input ref={inputRef} type="text" value={inputVal} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : undefined}
        className="text-sm outline-none border-none bg-transparent min-w-24 flex-1 py-0.5" />
    </div>
  );
}

// ─── Modal Components ─────────────────────────────────────────────────────────

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors";
const labelClass = "block text-xs font-medium text-gray-600 mb-1";

function AddEditModal({ mode, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    type: initial?.type || "video",
    url: initial?.url || "",
    description: initial?.description || "",
    difficulty: initial?.difficulty || "beginner",
    duration_minutes: initial?.duration_minutes || "",
    competency_tags: (initial?.competency_tags || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.url.trim()) { setError("URL is required."); return; }

    const competency_tags = form.competency_tags.split(",").map(t => t.trim()).filter(Boolean);
    const body = {
      title: form.title.trim(), type: form.type, url: form.url.trim(),
      description: form.description.trim(), difficulty: form.difficulty,
      duration_minutes: Number(form.duration_minutes) || null, competency_tags,
    };

    setSaving(true);
    try {
      const res = mode === "edit"
        ? await api.put(`/analytics/resources/${initial.id}`, body)
        : await api.post("/analytics/resources", body);
      onSave(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "An unexpected error occurred.");
    } finally { setSaving(false); }
  };

  const urlWarning = form.url && form.url.startsWith("http://") && !form.url.startsWith("https://");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{mode === "edit" ? "Edit Resource" : "Add Resource"}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Fields marked * are required</p>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input ref={titleRef} type="text" value={form.title} onChange={set("title")} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type *</label>
              <select value={form.type} onChange={set("type")} className={inputClass}>
                <option value="video">Video</option>
                <option value="reading">Reading</option>
                <option value="exercise">Exercise</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>URL *</label>
              <input type="url" value={form.url} onChange={set("url")} className={inputClass} />
              {urlWarning && <p className="text-xs text-yellow-600 mt-1">Use HTTPS for secure delivery</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={2} value={form.description} onChange={set("description")}
              placeholder="Brief description of what this resource covers"
              className={inputClass + " resize-none"} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Difficulty{" "}
                <span className="text-gray-400 cursor-help" title="Used by AI to weight recommendations by student level">(?)</span>
              </label>
              <select value={form.difficulty} onChange={set("difficulty")} className={inputClass}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Duration (minutes)</label>
              <input type="number" min={1} value={form.duration_minutes} onChange={set("duration_minutes")}
                placeholder="e.g. 15" className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Competency Tags
              <span className="ml-1 text-gray-400 font-normal">— Match competency codes for better AI matching</span>
            </label>
            <TagInput value={form.competency_tags}
              onChange={newVal => setForm(prev => ({ ...prev, competency_tags: newVal }))} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <button type="button" onClick={onClose}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors ${saving ? "opacity-50 cursor-not-allowed" : ""}`}>
              {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Resource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CSV_TEMPLATE = [
  "title,type,url,competency_tags,description,difficulty,duration_minutes",
  'Introduction to SQL,video,https://example.com/sql,sql database,"",beginner,15',
  '"Database Normalization Guide",reading,https://example.com/normalization,"normalization,sql","",intermediate,30',
].join("\n");

function ImportModal({ onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected); setUploadError(""); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target.result || "").split("\n").map(l => l.trim()).filter(Boolean);
      setPreview({ rows: lines.length > 1 ? lines.length - 1 : 0 });
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploadError(""); setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/analytics/resources/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      onImported(res.data);
    } catch (err) {
      setUploadError(err.response?.data?.detail || "Import failed. Please check your file and try again.");
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white max-w-lg w-full rounded-xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Bulk Import Resources</h2>
            <p className="text-sm text-gray-500 mt-0.5">Upload a CSV: title, type, url, competency_tags (optional)</p>
          </div>
          <button type="button"
            onClick={() => {
              const a = Object.assign(document.createElement("a"), {
                href: URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" })),
                download: "resources_template.csv",
              });
              a.click();
            }}
            className="text-xs border border-indigo-300 text-indigo-600 rounded px-2 py-1 hover:bg-indigo-50 transition-colors whitespace-nowrap ml-4 shrink-0">
            Download Template
          </button>
        </div>

        {uploadError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</div>}

        {result && (
          <div className="text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
            <p className="text-green-700 font-medium">Import complete</p>
            <p className="text-green-600">
              {result.imported} imported
              {result.skipped > 0 && `, ${result.skipped} skipped`}
              {result.errors?.length > 0 && <span className="text-amber-600"> — {result.errors.length} errors</span>}
            </p>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700 font-medium">{file.name}</p>
              {preview && (
                <span className="inline-block text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-0.5">
                  {preview.rows} {preview.rows === 1 ? "row" : "rows"} detected
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Click to select a CSV file</p>
              <p className="text-xs text-gray-400">Only .csv files are accepted</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          <button type="button" onClick={onClose}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleUpload} disabled={!file || uploading}
            className={`bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors ${!file || uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
            {uploading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
}
function IconUpload() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
}
function IconDownload() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}
function IconSearch() {
  return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}
function IconPencil() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
}
function IconTrash() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconExternalLink() {
  return <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
}
function IconClipboard() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
}
function IconBook() {
  return <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function IconSpinner() {
  return <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>;
}
function SortArrow({ active, dir }) {
  if (!active) return null;
  return (
    <svg className="w-3 h-3 inline ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      {dir === "asc"
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const { data: resources, loading, refetch } = useApi("/analytics/resources");

  const [toast, setToast]             = useState(null);
  const [confirm, setConfirm]         = useState(null);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [showImport, setShowImport]   = useState(false);
  const [deleting, setDeleting]       = useState(null);

  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [sortBy, setSortBy]           = useState("date");
  const [sortDir, setSortDir]         = useState("desc");
  const [page, setPage]               = useState(1);
  const PAGE_SIZE = 10;

  const [selected, setSelected]       = useState(new Set());
  const [copiedId, setCopiedId]       = useState(null);

  const showToast = useCallback((message, type = "success") => setToast({ message, type }), []);

  const handleDeleteClick = (resource) => {
    setConfirm({
      title: "Delete Resource",
      message: `"${resource.title}" will be permanently removed. This may affect active recommendations.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setDeleting(resource.id);
        try {
          await api.delete(`/analytics/resources/${resource.id}`);
          setSelected(s => { const n = new Set(s); n.delete(resource.id); return n; });
          refetch();
          showToast("Resource deleted.");
        } catch { showToast("Failed to delete resource.", "error"); }
        finally { setDeleting(null); }
      },
    });
  };

  const handleBulkDelete = () => {
    if (!selected.size) return;
    setConfirm({
      title: `Delete ${selected.size} Resource${selected.size > 1 ? "s" : ""}`,
      message: `This will permanently remove ${selected.size} resource${selected.size > 1 ? "s" : ""} and may affect active recommendations.`,
      confirmLabel: "Delete All",
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const count = selected.size;
        try {
          await Promise.all([...selected].map(id => api.delete(`/analytics/resources/${id}`)));
          setSelected(new Set());
          refetch();
          showToast(`${count} resources deleted.`);
        } catch { showToast("Some deletions failed.", "error"); }
      },
    });
  };

  const handleExport = () => {
    const header = "title,type,url,description,difficulty,duration_minutes,competency_tags";
    const rows = (resources || []).map(r =>
      [r.title, r.type, r.url, r.description || "", r.difficulty || "",
       r.duration_minutes || "", (r.competency_tags || []).join(";")]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([[header, ...rows].join("\n")], { type: "text/csv" })),
      download: "remedial_resources.csv",
    });
    a.click();
  };

  const handleCopyUrl = (resource) => {
    navigator.clipboard.writeText(resource.url).then(() => {
      setCopiedId(resource.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const typeCounts = (resources || []).reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1; return acc;
  }, {});

  const filtered = (resources || []).filter(r => {
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) ||
      (r.competency_tags || []).some(t => t.toLowerCase().includes(q)) ||
      (r.description || "").toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "alpha") cmp = a.title.localeCompare(b.title);
    else if (sortBy === "type") cmp = a.type.localeCompare(b.type);
    else cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (val) => {
    if (sortBy === val) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(val); setSortDir("desc"); }
    setPage(1);
  };

  const toggleSelected = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

        {showAddEdit && (
          <AddEditModal
            mode={editTarget ? "edit" : "add"}
            initial={editTarget}
            onSave={() => {
              const wasEdit = !!editTarget;
              setShowAddEdit(false); setEditTarget(null); refetch();
              showToast(wasEdit ? "Resource updated." : "Resource added.");
            }}
            onClose={() => { setShowAddEdit(false); setEditTarget(null); }}
          />
        )}

        {showImport && (
          <ImportModal
            onImported={result => { setShowImport(false); refetch(); showToast(`Imported ${result.imported} resources.`); }}
            onClose={() => setShowImport(false)}
          />
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Remedial Resources</h1>
            <p className="text-sm text-gray-500 mt-0.5">Videos, readings, and exercises used by the AI recommendation engine</p>
            {!loading && <StatSummary resources={resources} />}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <IconUpload /> Import CSV
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <IconDownload /> Export
            </button>
            <button onClick={() => { setEditTarget(null); setShowAddEdit(true); }}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <IconPlus /> Add Resource
            </button>
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-indigo-700">
            The AI recommendation engine matches a student's weak competency codes against these resource tags using tag-match scoring.
            Use specific tags that match your syllabus competency codes for best results.
            Add <strong>difficulty</strong> and <strong>duration</strong> to improve recommendation weighting.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><IconSearch /></span>
            <input type="text" placeholder="Search by title, tag, or description…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["all", "video", "reading", "exercise"].map(t => {
              const isActive = typeFilter === t;
              const count = t !== "all" ? (typeCounts[t] || 0) : null;
              return (
                <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                    isActive ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                  }`}>
                  {t === "all" ? "All Types" : t}
                  {count !== null && (
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort + bulk actions */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Sort:</span>
          {[["date","Date"],["alpha","A–Z"],["type","Type"]].map(([val, label]) => {
            const isActive = sortBy === val;
            return (
              <button key={val} onClick={() => handleSort(val)}
                className={`px-2 py-1 rounded transition-colors ${isActive ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                {label}<SortArrow active={isActive} dir={sortDir} />
              </button>
            );
          })}
          {selected.size > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-gray-600">{selected.size} selected</span>
              <button onClick={handleBulkDelete} className="text-red-600 hover:text-red-700 transition-colors font-medium">Delete selected</button>
            </span>
          )}
        </div>

        {/* Resource list */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : paginated.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
            <IconBook />
            {search || typeFilter !== "all" ? (
              <>
                <p className="text-gray-500 text-sm font-medium">No resources match your filters.</p>
                <p className="text-gray-400 text-xs mt-1 mb-4">Try adjusting your search or switching the type filter.</p>
                <button onClick={() => { setSearch(""); setTypeFilter("all"); setPage(1); }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-50">
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm font-medium">No resources yet.</p>
                <p className="text-gray-400 text-xs mt-1 mb-4">Add resources — the AI uses these tags to recommend materials to at-risk students.</p>
                <button onClick={() => { setEditTarget(null); setShowAddEdit(true); }}
                  className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Add your first resource
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-500">{sorted.length} result{sorted.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {paginated.map(r => (
                <div key={r.id} className="flex items-start gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)}
                    className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    aria-label={`Select ${r.title}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={r.type} />
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors truncate">
                        {r.title}
                      </a>
                      {r.difficulty && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">{r.difficulty}</span>
                      )}
                      {r.duration_minutes && (
                        <span className="text-xs text-gray-400">{r.duration_minutes} min</span>
                      )}
                    </div>

                    {r.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{r.description}</p>}

                    {r.competency_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {r.competency_tags.map(tag => (
                          <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-1">
                      <IconExternalLink />
                      <span className="text-xs text-gray-400 truncate flex-1">{r.url}</span>
                      <button onClick={() => handleCopyUrl(r)}
                        title={copiedId === r.id ? "Copied!" : "Copy URL"}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity p-0.5">
                        {copiedId === r.id
                          ? <span className="text-[10px] text-green-600 font-medium">Copied!</span>
                          : <IconClipboard />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditTarget(r); setShowAddEdit(true); }}
                      title="Edit" className="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                      <IconPencil />
                    </button>
                    <button onClick={() => handleDeleteClick(r)} disabled={deleting === r.id}
                      title="Delete" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      {deleting === r.id ? <IconSpinner /> : <IconTrash />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1;
              const ellipsisAfter  = p === 1 && page > 3;
              const ellipsisBefore = p === totalPages && page < totalPages - 2;
              return (
                <span key={p} className="flex items-center gap-1">
                  {ellipsisAfter  && <span className="text-xs text-gray-400 px-1">…</span>}
                  {show && (
                    <button onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === p ? "bg-indigo-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      {p}
                    </button>
                  )}
                  {ellipsisBefore && <span className="text-xs text-gray-400 px-1">…</span>}
                </span>
              );
            })}

            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
