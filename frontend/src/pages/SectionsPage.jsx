import { useState, useEffect, useCallback } from "react";
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

const EMPTY_FORM = { curriculum_id: "", section_name: "", year_level: "", academic_year: "" };

export default function SectionsPage() {
  const [curricula, setCurricula] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([api.get("/curricula/"), api.get("/sections/")]);
      setCurricula(cRes.data);
      setSections(sRes.data);
    } catch { showToast("Failed to load data", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const curriculumName = (id) => curricula.find(c => c.id === id)?.name || "—";

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowModal(true); };
  const openEdit = (s) => { setForm({ ...s, year_level: String(s.year_level) }); setEditTarget(s); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    const payload = { ...form, year_level: parseInt(form.year_level, 10) };
    try {
      if (editTarget) { await api.put(`/sections/${editTarget.id}`, payload); showToast("Section updated"); }
      else { await api.post("/sections/", payload); showToast("Section created"); }
      setShowModal(false); fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Save failed", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete section "${s.section_name}"?`)) return;
    try {
      await api.delete(`/sections/${s.id}`);
      showToast("Section deleted");
      fetchAll();
    } catch (err) { showToast(err.response?.data?.detail || "Delete failed", "error"); }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Sections</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage class sections assigned to each curriculum.</p>
          </div>
          <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Section
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Section Name", "Curriculum", "Year Level", "Academic Year", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-gray-100">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : sections.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No sections yet. Click "Add Section" to get started.</td></tr>
              ) : sections.map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.section_name}</td>
                  <td className="px-4 py-3 text-gray-600">{curriculumName(s.curriculum_id)}</td>
                  <td className="px-4 py-3 text-gray-600">Year {s.year_level}</td>
                  <td className="px-4 py-3 text-gray-600">{s.academic_year}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(s)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">{editTarget ? "Edit Section" : "Add Section"}</h2>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum <span className="text-red-400">*</span></label>
                  <select required value={form.curriculum_id} onChange={e => setForm(f => ({ ...f, curriculum_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select curriculum</option>
                    {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Section Name <span className="text-red-400">*</span></label>
                  <input required value={form.section_name} onChange={e => setForm(f => ({ ...f, section_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. BSIT-1A" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Year Level <span className="text-red-400">*</span></label>
                    <select required value={form.year_level} onChange={e => setForm(f => ({ ...f, year_level: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select</option>
                      {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Academic Year <span className="text-red-400">*</span></label>
                    <input required value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. 2025-2026" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Saving…" : editTarget ? "Save Changes" : "Create Section"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
