import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Layout from "../components/Layout";
import api from "../services/api";

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "bg-red-600" : "bg-green-600";
  return (
    <div className={`fixed bottom-4 right-4 ${bg} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[9999] flex items-center gap-2`}>
      {message}
      <button onClick={onClose} className="ml-1 text-white/70 hover:text-white">✕</button>
    </div>
  );
}

const EMPTY_FORM     = { student_number: "", student_name: "", email: "", section_id: "", curriculum_id: "", status: "active" };
const EMPTY_ADD_CURR = { section_id: "", curriculum_id: "", status: "active" };

const DownloadIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export default function EnrollmentPage() {
  const [sections,    setSections]    = useState([]);
  const [curricula,   setCurricula]   = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Single-enroll modal
  const [showModal,   setShowModal]   = useState(false);
  const [enrollMode,  setEnrollMode]  = useState("migration");
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);

  // Per-row Add Curriculum modal
  const [showAddCurr,    setShowAddCurr]    = useState(false);
  const [addCurrTarget,  setAddCurrTarget]  = useState(null);
  const [addCurrForm,    setAddCurrForm]    = useState(EMPTY_ADD_CURR);
  const [addCurrSaving,  setAddCurrSaving]  = useState(false);

  // Bulk Add Curriculum modal
  const [showBulk,         setShowBulk]         = useState(false);
  const [bulkSrcSections,  setBulkSrcSections]  = useState(new Set());
  const [bulkChecked,      setBulkChecked]       = useState(new Set());
  const [bulkCurriculumId, setBulkCurriculumId] = useState("");
  const [bulkSubmitting,   setBulkSubmitting]   = useState(false);
  const [bulkResult,       setBulkResult]       = useState(null);

  // CSV bulk upload
  const [csvFile,      setCsvFile]      = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult,    setCsvResult]    = useState(null);
  const csvInputRef = useRef(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, eRes] = await Promise.all([
        api.get("/sections/"), api.get("/curricula/"), api.get("/enrollments/"),
      ]);
      setSections(sRes.data);
      setCurricula(cRes.data);
      setEnrollments(eRes.data);
    } catch { showToast("Failed to load data", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // T8: most-recent enrollment per student → "Current" badge
  const currentEnrollmentIds = useMemo(() => {
    const groups = {};
    for (const e of enrollments) {
      if (!groups[e.student_id_hash]) groups[e.student_id_hash] = [];
      groups[e.student_id_hash].push(e);
    }
    const ids = new Set();
    for (const group of Object.values(groups)) {
      // Pick the enrollment with the latest date; fall back to last in array if dates are null
      let latest = group[group.length - 1];
      for (const e of group) {
        if (!e.enrollment_date) continue;
        if (!latest.enrollment_date || new Date(e.enrollment_date) > new Date(latest.enrollment_date)) {
          latest = e;
        }
      }
      ids.add(latest.id);
    }
    return ids;
  }, [enrollments]);

  // Bulk: deduplicated students from selected source sections
  const bulkStudents = useMemo(() => {
    if (bulkSrcSections.size === 0) return [];
    const seen = new Set();
    const result = [];
    for (const e of enrollments) {
      if (bulkSrcSections.has(e.section_id) && !seen.has(e.student_id_hash)) {
        seen.add(e.student_id_hash);
        result.push({
          student_id_hash: e.student_id_hash,
          section_id:      e.section_id,
          student_number:  e.student_number,
          student_name:    e.student_name,
          section_name:    sections.find(s => s.id === e.section_id)?.section_name || "—",
        });
      }
    }
    return result;
  }, [enrollments, bulkSrcSections, sections]);

  // When source sections change, reset checkboxes to all-checked
  useEffect(() => {
    setBulkChecked(new Set(bulkStudents.map(s => s.student_id_hash)));
  }, [bulkStudents]);

  const sectionName   = (id) => sections.find(s => s.id === id)?.section_name || "—";
  const curriculumName = (id) => curricula.find(c => c.id === id)?.name || "—";

  // ── Single enroll ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, student_number: enrollMode === "new_student" ? "" : form.student_number };
      await api.post("/enrollments/", payload);
      showToast("Student enrolled");
      setShowModal(false); setForm(EMPTY_FORM); fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Enrollment failed", "error"); }
    finally { setSaving(false); }
  };

  const handleUnenroll = async (id) => {
    if (!window.confirm("Remove this enrollment?")) return;
    try {
      await api.delete(`/enrollments/${id}`);
      showToast("Enrollment removed"); fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Failed to remove", "error"); }
  };

  // ── Per-row Add Curriculum ─────────────────────────────────────────────────
  const openAddCurr = (enrollment) => {
    setAddCurrTarget({ student_id_hash: enrollment.student_id_hash, student_name: enrollment.student_name, student_number: enrollment.student_number });
    setAddCurrForm(EMPTY_ADD_CURR);
    setShowAddCurr(true);
  };

  const handleAddCurriculum = async (e) => {
    e.preventDefault(); setAddCurrSaving(true);
    try {
      await api.post("/enrollments/add-curriculum", { student_id_hash: addCurrTarget.student_id_hash, ...addCurrForm });
      showToast("Curriculum added"); setShowAddCurr(false); fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Failed to add curriculum", "error"); }
    finally { setAddCurrSaving(false); }
  };

  // ── Bulk Add Curriculum ────────────────────────────────────────────────────
  const openBulkModal = () => {
    setBulkSrcSections(new Set());
    setBulkChecked(new Set());
    setBulkCurriculumId("");
    setBulkResult(null);
    setShowBulk(true);
  };

  const toggleBulkSection = (id) => {
    setBulkSrcSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBulkStudent = (hash) => {
    setBulkChecked(prev => {
      const next = new Set(prev);
      next.has(hash) ? next.delete(hash) : next.add(hash);
      return next;
    });
  };

  const handleBulkSubmit = async () => {
    if (!bulkCurriculumId) { showToast("Select a curriculum first", "error"); return; }
    const selected = bulkStudents.filter(s => bulkChecked.has(s.student_id_hash));
    if (selected.length === 0) { showToast("No students selected", "error"); return; }
    setBulkSubmitting(true);
    try {
      const res = await api.post("/enrollments/bulk-add-curriculum", {
        students: selected.map(s => ({ student_id_hash: s.student_id_hash, section_id: s.section_id })),
        curriculum_id: bulkCurriculumId,
        status: "active",
      });
      setBulkResult(res.data);
      showToast(`Added curriculum to ${res.data.added} student(s)`);
      fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Failed", "error"); }
    finally { setBulkSubmitting(false); }
  };

  // ── CSV templates ──────────────────────────────────────────────────────────
  const triggerCsvDownload = (rows, filename) => {
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const downloadMigrationTemplate = () => triggerCsvDownload([
    ["student_number", "student_name", "email", "section_name", "curriculum_name", "status"],
    ["2021000031", "Juan dela Cruz", "juan.delacruz@btech.edu.ph", "BSIT-1A", "BS Information Technology 2021", "active"],
  ], "enrollment_migration_template.csv");

  const downloadNewStudentTemplate = () => triggerCsvDownload([
    ["student_name", "email", "section_name", "curriculum_name", "status"],
    ["Juan dela Cruz", "juan.delacruz@btech.edu.ph", "BSIT-1A", "BS Information Technology 2021", "active"],
  ], "enrollment_new_student_template.csv");

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setCsvUploading(true); setCsvResult(null);
    const formData = new FormData();
    formData.append("file", csvFile);
    try {
      const res = await api.post("/enrollments/bulk-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setCsvResult(res.data);
      showToast(`${res.data.enrolled} students enrolled`);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
      fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "CSV upload failed", "error"); }
    finally { setCsvUploading(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Enrollment</h1>
            <p className="text-sm text-gray-500 mt-0.5">Enroll students into sections and manage their enrollment status.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openBulkModal}
              className="border border-indigo-300 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Bulk Add Curriculum
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setEnrollMode("migration"); setShowModal(true); }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Enroll Student
            </button>
          </div>
        </div>

        {/* Bulk CSV card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Bulk Enrollment via CSV</h2>
          <p className="text-xs text-gray-500 mb-1">Mode is auto-detected from the CSV columns:</p>
          <ul className="text-xs text-gray-500 list-disc list-inside mb-3 space-y-0.5">
            <li><span className="font-medium text-gray-600">Migration</span> — include <code className="bg-gray-100 px-1 rounded">student_number</code> column (existing BTECH students).</li>
            <li><span className="font-medium text-gray-600">New Student</span> — omit <code className="bg-gray-100 px-1 rounded">student_number</code> column (system auto-assigns).</li>
          </ul>
          <p className="text-xs text-gray-400 mb-3">
            Required in both modes: <code className="bg-gray-100 px-1 rounded">student_name</code>, <code className="bg-gray-100 px-1 rounded">email</code>, <code className="bg-gray-100 px-1 rounded">section_name</code>, <code className="bg-gray-100 px-1 rounded">curriculum_name</code>.{" "}
            Optional: <code className="bg-gray-100 px-1 rounded">status</code> (defaults to <em>active</em>).
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={downloadMigrationTemplate}
              className="inline-flex items-center gap-1.5 border border-indigo-300 text-indigo-600 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
              <DownloadIcon /> Migration Template
            </button>
            <button onClick={downloadNewStudentTemplate}
              className="inline-flex items-center gap-1.5 border border-emerald-300 text-emerald-600 text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors">
              <DownloadIcon /> New Student Template
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input ref={csvInputRef} type="file" accept=".csv"
              onChange={e => { setCsvFile(e.target.files[0] || null); setCsvResult(null); }}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" />
            <button onClick={handleCsvUpload} disabled={!csvFile || csvUploading}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {csvUploading ? "Uploading…" : "Upload"}
            </button>
          </div>
          {csvResult && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Successfully enrolled <strong>{csvResult.enrolled}</strong> student(s).
                {csvResult.accounts_created > 0 && (
                  <span className="ml-1">(<strong>{csvResult.accounts_created}</strong> new account{csvResult.accounts_created !== 1 ? "s" : ""} created — welcome emails sent.)</span>
                )}
              </div>
              {csvResult.errors?.length > 0 && (
                <div className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 space-y-0.5 max-h-28 overflow-y-auto">
                  {csvResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enrollment roster table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Enrollment Roster</span>
            <span className="text-xs text-gray-400">{enrollments.length} record{enrollments.length !== 1 ? "s" : ""}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Student Number", "Student Name", "Section", "Curriculum", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-100">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : enrollments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No enrollments yet.</td></tr>
              ) : enrollments.map(e => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.student_number ?? <span className="text-gray-300 italic">unknown</span>}</td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{e.student_name ?? <span className="text-gray-300 italic">—</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{sectionName(e.section_id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600">{curriculumName(e.curriculum_id)}</span>
                      {currentEnrollmentIds.has(e.id) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">Current</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openAddCurr(e)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium whitespace-nowrap">
                        + Curriculum
                      </button>
                      <button onClick={() => handleUnenroll(e.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Single-enroll modal ── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Enroll Student</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Select a mode, fill in student details, and assign a section and curriculum.</p>
                </div>
                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button type="button" onClick={() => setEnrollMode("migration")}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${enrollMode === "migration" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
                    Migration
                  </button>
                  <button type="button" onClick={() => setEnrollMode("new_student")}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${enrollMode === "new_student" ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}>
                    New Student
                  </button>
                </div>
                <p className="text-xs text-gray-400 -mt-1">
                  {enrollMode === "migration" ? "Student already has a BTECH student number — enter it below." : "First-time student — the system will auto-assign a student number."}
                </p>
                {enrollMode === "migration" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Student Number <span className="text-red-400">*</span></label>
                    <input required type="text" value={form.student_number}
                      onChange={e => setForm(f => ({ ...f, student_number: e.target.value }))}
                      placeholder="e.g. 2021000031"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-400">*</span></label>
                  <input required type="text" value={form.student_name}
                    onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))}
                    placeholder="e.g. Juan dela Cruz"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Address <span className="text-red-400">*</span></label>
                  <input required type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="e.g. juan.delacruz@btech.edu.ph"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Section <span className="text-red-400">*</span></label>
                  <select required value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum <span className="text-red-400">*</span></label>
                  <select required value={form.curriculum_id} onChange={e => setForm(f => ({ ...f, curriculum_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select curriculum</option>
                    {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Enrolling…" : "Enroll"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Per-row Add Curriculum modal ── */}
        {showAddCurr && addCurrTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Add Curriculum</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {addCurrTarget.student_name ?? "Student"}
                    {addCurrTarget.student_number ? ` · ${addCurrTarget.student_number}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setShowAddCurr(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>
              <form onSubmit={handleAddCurriculum} className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Section <span className="text-red-400">*</span></label>
                  <select required value={addCurrForm.section_id}
                    onChange={e => setAddCurrForm(f => ({ ...f, section_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum <span className="text-red-400">*</span></label>
                  <select required value={addCurrForm.curriculum_id}
                    onChange={e => setAddCurrForm(f => ({ ...f, curriculum_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select curriculum</option>
                    {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={addCurrForm.status}
                    onChange={e => setAddCurrForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowAddCurr(false)}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={addCurrSaving}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {addCurrSaving ? "Saving…" : "Add Curriculum"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Bulk Add Curriculum modal ── */}
        {showBulk && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Bulk Add Curriculum</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Select sections, review students, then pick the curriculum to add.</p>
                </div>
                <button type="button" onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
              </div>

              <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">

                {/* Step 1: Source sections */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">1. Select source sections</p>
                  {sections.length === 0 ? (
                    <p className="text-xs text-gray-400">No sections found.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sections.map(s => (
                        <button key={s.id} type="button" onClick={() => toggleBulkSection(s.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            bulkSrcSections.has(s.id)
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                          }`}>
                          {s.section_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: Student roster */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">
                      2. Students
                      {bulkStudents.length > 0 && (
                        <span className="ml-1.5 text-gray-400 font-normal">
                          {bulkChecked.size} of {bulkStudents.length} selected
                        </span>
                      )}
                    </p>
                    {bulkStudents.length > 0 && (
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={() => setBulkChecked(new Set(bulkStudents.map(s => s.student_id_hash)))}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          Select all
                        </button>
                        <span className="text-gray-300">|</span>
                        <button type="button"
                          onClick={() => setBulkChecked(new Set())}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>

                  {bulkSrcSections.size === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-xs text-gray-400">
                      Select one or more sections above to load students.
                    </div>
                  ) : bulkStudents.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center text-xs text-gray-400">
                      No enrolled students found in the selected sections.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 w-8"></th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Student No.</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Section</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkStudents.map(s => (
                            <tr key={s.student_id_hash}
                              onClick={() => toggleBulkStudent(s.student_id_hash)}
                              className={`border-b border-gray-100 cursor-pointer transition-colors ${bulkChecked.has(s.student_id_hash) ? "bg-indigo-50/50" : "hover:bg-gray-50"}`}>
                              <td className="px-3 py-2 text-center">
                                <input type="checkbox" readOnly
                                  checked={bulkChecked.has(s.student_id_hash)}
                                  className="accent-indigo-600 cursor-pointer" />
                              </td>
                              <td className="px-3 py-2 font-mono text-gray-600">{s.student_number ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-700">{s.student_name ?? "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{s.section_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Step 3: Target curriculum */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">3. Curriculum to add</p>
                  <select value={bulkCurriculumId} onChange={e => setBulkCurriculumId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select curriculum</option>
                    {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Students already enrolled in this curriculum will be skipped automatically.
                  </p>
                </div>

                {/* Result banner */}
                {bulkResult && (
                  <div className="text-xs bg-green-50 text-green-700 rounded-lg px-3 py-2">
                    Done — <strong>{bulkResult.added}</strong> enrollment{bulkResult.added !== 1 ? "s" : ""} added.
                    {bulkResult.skipped > 0 && <span className="ml-1 text-green-600">({bulkResult.skipped} already enrolled, skipped.)</span>}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
                <span className="text-xs text-gray-400">
                  {bulkChecked.size > 0 ? `${bulkChecked.size} student${bulkChecked.size !== 1 ? "s" : ""} will be enrolled` : "No students selected"}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowBulk(false)}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                    {bulkResult ? "Close" : "Cancel"}
                  </button>
                  {!bulkResult && (
                    <button type="button" onClick={handleBulkSubmit}
                      disabled={bulkSubmitting || bulkChecked.size === 0 || !bulkCurriculumId}
                      className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {bulkSubmitting ? "Adding…" : `Add Curriculum to ${bulkChecked.size} student${bulkChecked.size !== 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
