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

const EMPTY_FORM = { program_name: "", degree_type: "", ched_cmo_reference: "", total_units: "", description: "" };

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/programs/");
      setPrograms(res.data);
    } catch {
      showToast("Failed to load programs", "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setShowModal(true); };
  const openEdit = (p) => { setForm({ ...p, total_units: String(p.total_units) }); setEditTarget(p); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, total_units: parseInt(form.total_units, 10) };
    try {
      if (editTarget) {
        await api.put(`/programs/${editTarget.id}`, payload);
        showToast("Program updated");
      } else {
        await api.post("/programs/", payload);
        showToast("Program created");
      }
      setShowModal(false);
      fetchPrograms();
    } catch (err) {
      showToast(err.response?.data?.detail || "Save failed", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.program_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/programs/${p.id}`);
      showToast("Program deleted");
      fetchPrograms();
    } catch (err) {
      showToast(err.response?.data?.detail || "Delete failed", "error");
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Programs</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage degree programs offered by the institution.</p>
          </div>
          <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Program
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Program Name", "Degree Type", "CHED CMO Ref.", "Total Units", "Actions"].map(h => (
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
              ) : programs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No programs yet. Click "Add Program" to get started.</td></tr>
              ) : programs.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.program_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.degree_type}</td>
                  <td className="px-4 py-3 text-gray-500">{p.ched_cmo_reference || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{p.total_units} units</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(p)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
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
                <h2 className="text-base font-semibold text-gray-800">{editTarget ? "Edit Program" : "Add Program"}</h2>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Program Name <span className="text-red-400">*</span></label>
                  <input required value={form.program_name} onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Bachelor of Science in Information Technology" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Degree Type <span className="text-red-400">*</span></label>
                  <select required value={form.degree_type} onChange={e => setForm(f => ({ ...f, degree_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select degree type</option>
                    {["Bachelor", "Master", "Doctorate", "Associate", "Certificate"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CHED CMO Reference</label>
                  <input value={form.ched_cmo_reference} onChange={e => setForm(f => ({ ...f, ched_cmo_reference: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. CMO No. 25 s. 2015" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Units <span className="text-red-400">*</span></label>
                  <input required type="number" min={1} value={form.total_units} onChange={e => setForm(f => ({ ...f, total_units: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 178" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Optional program description" />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Saving…" : editTarget ? "Save Changes" : "Create Program"}
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
