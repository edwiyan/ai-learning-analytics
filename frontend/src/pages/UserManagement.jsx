import { useState, useCallback, useEffect } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { useApi } from "../hooks/useApi";

const PAGE_SIZE = 10;
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const PROGRAMS = ["BSIT", "BSCS", "BSA", "BSBA", "BEEd", "BSEd", "Other"];
const COLLEGES = [
  { value: "ICS",  label: "Institute of Computer Studies (ICS)" },
  { value: "CBA",  label: "College of Business and Accountancy (CBA)" },
  { value: "CoEd", label: "College of Education (CoEd)" },
];
const COLLEGE_SCOPED_ROLES = new Set(["instructor", "program_director", "dean"]);
const ROLES = {
  admin: "Admin",
  instructor: "Instructor",
  student: "Student",
  program_director: "Program Director",
  dean: "Dean",
  vp_academic_affairs: "VP Academic Affairs",
};
const ROLE_COLORS = {
  admin: "bg-purple-100 text-purple-700",
  instructor: "bg-indigo-100 text-indigo-700",
  student: "bg-gray-100 text-gray-600",
  program_director: "bg-teal-100 text-teal-700",
  dean: "bg-amber-100 text-amber-700",
  vp_academic_affairs: "bg-rose-100 text-rose-700",
};

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "bg-red-600" : "bg-green-600";
  return (
    <div className={`fixed bottom-4 right-4 ${bg} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[9999] flex items-center gap-2`}>
      {message}
      <button onClick={onClose} className="ml-1 text-white/70 hover:text-white leading-none">✕</button>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="px-6 py-4 flex gap-2 justify-end border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const SKELETON_WIDTHS = ["w-20", "w-28", "w-24", "w-16", "w-12", "w-20", "w-10", "w-16", "w-10"];
function TableRowSkeleton({ cols = 8 }) {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-3 bg-gray-200 rounded ${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}`} />
        </td>
      ))}
    </tr>
  );
}

function getPasswordStrength(pwd) {
  if (!pwd) return { level: 0, label: "", color: "bg-gray-200" };
  const strong = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(pwd) && pwd.length >= 8;
  if (strong) return { level: 3, label: "Strong", color: "bg-green-500" };
  if (pwd.length >= 6) return { level: 2, label: "Medium", color: "bg-amber-500" };
  return { level: 1, label: "Weak", color: "bg-red-500" };
}

function Field({ label, value, onChange, type = "text", placeholder, required, span, error }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-gray-400 ml-1 font-normal">(optional)</span>}
      </label>
      <input required={required} type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${error ? "border-red-400" : "border-gray-300"}`} />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

const EMPTY_STUDENT_FORM = { full_name: "", email: "", password: "", student_number: "", year_level: "", program: "", section: "" };

function AddUserModal({ role, onClose, onCreated }) {
  const isStudent = role === "student";
  const needsCollege = COLLEGE_SCOPED_ROLES.has(role);
  const [form, setForm] = useState(isStudent ? EMPTY_STUDENT_FORM : { full_name: "", email: "", password: "", role, college: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email required";
    if (!form.password || form.password.length < 6) errs.password = "Min 6 characters";
    if (isStudent && !form.student_number.trim()) errs.student_number = "Required";
    if (needsCollege && !form.college) errs.college = "Required for this role";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const payload = isStudent ? { ...form, role: "student" } : form;
      const res = await api.post("/users/", payload);
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user");
    } finally { setSaving(false); }
  };

  const strength = getPasswordStrength(form.password);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Add {ROLES[role]}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{isStudent ? "Student number, name, and email are required" : "All fields are required"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" span={2} required value={form.full_name} onChange={v => set("full_name", v)} error={fieldErrors.full_name} />
            <Field label="Email" type="email" span={2} required value={form.email} onChange={v => set("email", v)} error={fieldErrors.email} />
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Password<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)}
                  className={`w-full border rounded px-2 py-1.5 text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.password ? "border-red-400" : "border-gray-300"}`} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPwd
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.password}</p>}
              {form.password && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-gray-200 rounded overflow-hidden">
                    <div className={`h-full rounded transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.level / 3) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength.level === 3 ? "text-green-600" : strength.level === 2 ? "text-amber-600" : "text-red-500"}`}>{strength.label}</span>
                </div>
              )}
            </div>
            {needsCollege && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  College / Institute<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select value={form.college} onChange={e => set("college", e.target.value)}
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.college ? "border-red-400" : "border-gray-300"}`}>
                  <option value="">— Select college / institute —</option>
                  {COLLEGES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {fieldErrors.college && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.college}</p>}
              </div>
            )}
            {isStudent && <>
              <Field label="Student Number" required value={form.student_number} onChange={v => set("student_number", v)} placeholder="e.g. 2023-00001" error={fieldErrors.student_number} />
              <Field label="Section" value={form.section} onChange={v => set("section", v)} placeholder="e.g. A" />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Year Level <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={form.year_level} onChange={e => set("year_level", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">— Select —</option>
                  {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Program <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={form.program} onChange={e => set("program", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">— Select —</option>
                  {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </>}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Creating..." : `Create ${ROLES[role]}`}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStudentModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: student.full_name || "",
    email: student.email || "",
    student_number: student.student_number || "",
    year_level: student.year_level || "",
    program: student.program || "",
    section: student.section || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await api.put(`/users/${student.id}`, form);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update student");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Edit Student</h2>
            <p className="text-xs text-gray-500 mt-0.5">{student.full_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" span={2} required value={form.full_name} onChange={v => set("full_name", v)} />
            <Field label="Email" type="email" span={2} required value={form.email} onChange={v => set("email", v)} />
            <Field label="Student Number" required value={form.student_number} onChange={v => set("student_number", v)} />
            <Field label="Section" value={form.section} onChange={v => set("section", v)} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year Level <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={form.year_level} onChange={e => set("year_level", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">— Select —</option>
                {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Program <span className="text-gray-400 font-normal">(optional)</span></label>
              <select value={form.program} onChange={e => set("program", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">— Select —</option>
                {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const downloadTemplate = () => {
    const ws = [
      ["student_number", "full_name", "email", "password", "year_level", "program", "section"],
      ["2023-00001", "Juan dela Cruz", "juan@school.edu", "Password@1", "1st Year", "BSIT", "A"],
      ["2023-00002", "Maria Santos", "maria@school.edu", "Password@2", "2nd Year", "BSCS", "B"],
    ].map(r => r.join(",")).join("\n");
    const blob = new Blob([ws], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "students_template.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File exceeds 5MB limit"); return; }
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setError("Only .csv and .xlsx files are supported"); return; }
    setUploading(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await api.post("/users/bulk-import", fd);
      setResult(res.data);
      onDone(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Import Students via Excel / CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-700 font-mono">
            <p className="font-semibold mb-1">Required columns:</p>
            <p>student_number, full_name, email</p>
            <p className="mt-1 font-semibold">Optional:</p>
            <p>password, year_level, program, section</p>
            <p className="mt-1 text-indigo-500 italic">If password is blank, student number is used as default.</p>
          </div>
          <button onClick={downloadTemplate}
            className="w-full border border-indigo-300 text-indigo-600 text-sm py-2 rounded-lg hover:bg-indigo-50 transition-colors">
            Download template (.csv)
          </button>
          {!result ? (
            <form onSubmit={handleUpload} className="space-y-3">
              <p className="text-xs text-gray-500">Accepted: .csv, .xlsx — max 5MB</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center hover:border-indigo-400 transition-colors">
                <input type="file" accept=".xlsx,.csv" id="import-file" className="hidden"
                  onChange={e => setFile(e.target.files[0])} />
                <label htmlFor="import-file" className="cursor-pointer text-indigo-600 text-sm font-medium hover:underline">
                  {file ? file.name : "Click to select .xlsx or .csv"}
                </label>
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <svg className="animate-spin h-4 w-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing… this may take a moment.
                </div>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={uploading || !file}
                className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {uploading ? "Importing..." : "Import Students"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                  <p className="text-xs text-gray-500">Created</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
              <button onClick={onClose}
                className="w-full bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortTh({ field, label, sort, onSort, className = "" }) {
  const active = sort.field === field;
  return (
    <th className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-indigo-600 transition-colors ${className}`} onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={active ? "text-indigo-500" : "text-gray-300"}>{active ? (sort.order === "asc" ? "↑" : "↓") : "↕"}</span>
      </span>
    </th>
  );
}

function StudentsTab({ isAdmin, onCount }) {
  const [filters, setFilters] = useState({ year_level: "", program: "", section: "" });
  const [applied, setApplied] = useState({});
  const [search, setSearch] = useState("");
  const [localList, setLocalList] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [confirmActivate, setConfirmActivate] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [sort, setSort] = useState({ field: "full_name", order: "asc" });
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const params = new URLSearchParams(Object.fromEntries(Object.entries(applied).filter(([, v]) => v)));
  const { data: fetched, loading, refetch } = useApi(`/users/students?${params}`, [JSON.stringify(applied)]);
  const rawStudents = localList ?? fetched ?? [];

  const searched = search.trim()
    ? rawStudents.filter(s =>
        (s.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.student_number || "").toLowerCase().includes(search.toLowerCase())
      )
    : rawStudents;

  const students = [...searched].sort((a, b) => {
    const av = String(a[sort.field] ?? "").toLowerCase();
    const bv = String(b[sort.field] ?? "").toLowerCase();
    return sort.order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  useEffect(() => { setPage(1); }, [JSON.stringify(applied), search]);
  useEffect(() => { if (fetched !== undefined) onCount(fetched?.length ?? 0); }, [fetched]);

  const toggleSort = (field) => {
    setSort(s => s.field === field ? { field, order: s.order === "asc" ? "desc" : "asc" } : { field, order: "asc" });
    setPage(1);
  };

  const handleDeactivate = async (userId) => {
    setDeactivatingId(userId);
    try {
      await api.delete(`/users/${userId}`);
      setLocalList(rawStudents.map(u => u.id === userId ? { ...u, is_active: false } : u));
      setToast({ message: "Student deactivated", type: "success" });
    } catch { setToast({ message: "Failed to deactivate", type: "error" }); }
    finally { setDeactivatingId(null); setConfirmDeactivate(null); }
  };

  const handleActivate = async (userId) => {
    setActivatingId(userId);
    try {
      await api.put(`/users/${userId}`, { is_active: true });
      setLocalList(rawStudents.map(u => u.id === userId ? { ...u, is_active: true } : u));
      setToast({ message: "Student activated", type: "success" });
    } catch { setToast({ message: "Failed to activate", type: "error" }); }
    finally { setActivatingId(null); setConfirmActivate(null); }
  };

  const handleCreated = (u) => {
    setLocalList([...(localList ?? fetched ?? []), u]);
    setToast({ message: `${u.full_name} added successfully`, type: "success" });
  };

  const handleImportDone = (result) => {
    setLocalList(null); refetch?.();
    setToast({ message: `${result.created} student${result.created !== 1 ? "s" : ""} imported`, type: "success" });
  };

  const handleSaved = (updated) => {
    setLocalList(rawStudents.map(u => u.id === updated.id ? { ...u, ...updated } : u));
    setToast({ message: "Student updated", type: "success" });
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const applyFilters = () => { setApplied({ ...filters }); setLocalList(null); };
  const clearAll = () => { setFilters({ year_level: "", program: "", section: "" }); setApplied({}); setSearch(""); setLocalList(null); };
  const removeApplied = (key) => {
    const n = { ...applied }; delete n[key];
    setApplied(n); setFilters(f => ({ ...f, [key]: "" })); setLocalList(null);
  };

  const hasActiveFilters = Object.values(applied).some(Boolean) || search.trim();
  const activeChips = Object.entries(applied).filter(([, v]) => v);
  const sortProps = { sort, onSort: toggleSort };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Name, email, or student #"
                className="w-full border border-gray-300 rounded pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year Level</label>
            <select value={filters.year_level} onChange={e => setFilter("year_level", e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">All Years</option>
              {YEAR_LEVELS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Program</label>
            <select value={filters.program} onChange={e => setFilter("program", e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">All Programs</option>
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
            <input value={filters.section} onChange={e => setFilter("section", e.target.value)}
              placeholder="e.g. A"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={applyFilters}
            className="bg-indigo-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
            Apply Filters
          </button>
          {hasActiveFilters && (
            <button onClick={clearAll}
              className="text-gray-500 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Clear All
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {loading ? "Loading..." : `${students.length} student${students.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
            {activeChips.map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5 text-xs text-indigo-700">
                {key.replace("_", " ")}: {value}
                <button onClick={() => removeApplied(key)} className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isAdmin && (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
            + Add Student
          </button>
          <button onClick={() => setShowImport(true)}
            className="border border-indigo-300 text-indigo-600 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            Import Excel / CSV
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 font-medium">#</th>
              <SortTh field="full_name" label="Name" {...sortProps} />
              <SortTh field="email" label="Email" {...sortProps} />
              <th className="px-4 py-3 font-medium">Student #</th>
              <SortTh field="year_level" label="Year" {...sortProps} />
              <SortTh field="program" label="Program" {...sortProps} />
              <SortTh field="section" label="Section" {...sortProps} />
              <SortTh field="is_active" label="Status" {...sortProps} />
              {isAdmin && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && rawStudents.length === 0
              ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={isAdmin ? 9 : 8} />)
              : students.length === 0
              ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm text-gray-400">
                    {hasActiveFilters ? "No students match these filters." : "No students yet."}
                  </p>
                  {hasActiveFilters
                    ? <button onClick={clearAll} className="mt-2 text-xs text-indigo-600 hover:underline">Clear filters</button>
                    : isAdmin && (
                      <button onClick={() => setShowAdd(true)} className="mt-3 inline-flex items-center gap-1 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
                        + Add the first student
                      </button>
                    )
                  }
                </td></tr>
              )
              : students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u, i) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-700">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{u.student_number || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.year_level || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.program || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.section || "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge active={u.is_active} /></td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditStudent(u)} title="Edit"
                          className="text-gray-300 hover:text-indigo-600 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {u.is_active
                          ? <button onClick={() => setConfirmDeactivate(u)} disabled={deactivatingId === u.id}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                              {deactivatingId === u.id ? "…" : "Deactivate"}
                            </button>
                          : <button onClick={() => setConfirmActivate(u)} disabled={activatingId === u.id}
                              className="text-xs text-green-600 hover:text-green-700 transition-colors disabled:opacity-50">
                              {activatingId === u.id ? "…" : "Activate"}
                            </button>
                        }
                      </div>
                    </td>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
        {students.length > PAGE_SIZE && (
          <Pagination page={page} total={students.length} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </div>

      {showAdd && <AddUserModal role="student" onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={handleImportDone} />}
      {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSaved={handleSaved} />}
      {confirmDeactivate && (
        <ConfirmModal
          title="Deactivate Student"
          message={`Are you sure you want to deactivate ${confirmDeactivate.full_name}? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => handleDeactivate(confirmDeactivate.id)}
          onCancel={() => setConfirmDeactivate(null)}
        />
      )}
      {confirmActivate && (
        <ConfirmModal
          title="Activate Student"
          message={`Activate ${confirmActivate.full_name}? They will regain access to the system.`}
          confirmLabel="Activate"
          onConfirm={() => handleActivate(confirmActivate.id)}
          onCancel={() => setConfirmActivate(null)}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StaffEditModal({ user: u, role, onClose, onSaved }) {
  const needsCollege = COLLEGE_SCOPED_ROLES.has(u.role || role);
  const [form, setForm] = useState({
    full_name: u.full_name || "",
    email: u.email || "",
    college: u.college || "",
    is_active: u.is_active,
    new_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email required";
    if (needsCollege && !form.college) errs.college = "Required for this role";
    if (form.new_password && form.new_password.length < 6) errs.new_password = "Min 6 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        college: form.college || null,
        is_active: form.is_active,
      };
      if (form.new_password) payload.new_password = form.new_password;
      const res = await api.put(`/users/${u.id}`, payload);
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save changes");
    } finally { setSaving(false); }
  };

  const strength = getPasswordStrength(form.new_password);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Edit {ROLES[u.role || role]}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{u.full_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Basic info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic Information</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name<span className="text-red-500 ml-0.5">*</span></label>
              <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.full_name ? "border-red-400" : "border-gray-300"}`} />
              {fieldErrors.full_name && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.full_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email<span className="text-red-500 ml-0.5">*</span></label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.email ? "border-red-400" : "border-gray-300"}`} />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.email}</p>}
            </div>
            {needsCollege && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">College / Institute<span className="text-red-500 ml-0.5">*</span></label>
                <select value={form.college} onChange={e => set("college", e.target.value)}
                  className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.college ? "border-red-400" : "border-gray-300"}`}>
                  <option value="">— Select —</option>
                  {COLLEGES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {fieldErrors.college && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.college}</p>}
              </div>
            )}
          </div>

          {/* Account status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Status</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} />
                <div className={`w-9 h-5 rounded-full transition-colors ${form.is_active ? "bg-indigo-600" : "bg-gray-300"}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-sm text-gray-700">{form.is_active ? "Active" : "Inactive"}</span>
            </label>
          </div>

          {/* Password reset */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reset Password <span className="text-gray-300 font-normal normal-case">(leave blank to keep current)</span></p>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} value={form.new_password}
                onChange={e => set("new_password", e.target.value)}
                placeholder="New password…"
                className={`w-full border rounded px-2 py-1.5 text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${fieldErrors.new_password ? "border-red-400" : "border-gray-300"}`} />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPwd
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                  }
                </svg>
              </button>
            </div>
            {fieldErrors.new_password && <p className="text-xs text-red-500">{fieldErrors.new_password}</p>}
            {form.new_password && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-200 rounded overflow-hidden">
                  <div className={`h-full rounded transition-all ${strength.color}`} style={{ width: `${(strength.level / 3) * 100}%` }} />
                </div>
                <span className={`text-xs font-medium ${strength.level === 3 ? "text-green-600" : strength.level === 2 ? "text-amber-600" : "text-red-500"}`}>{strength.label}</span>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 text-white text-sm py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewProfileModal({ user: u, role, onClose, onEdit }) {
  const college = COLLEGES.find(c => c.value === u.college);
  const rows = [
    { label: "Full Name",   value: u.full_name },
    { label: "Email",       value: u.email },
    { label: "Role",        value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role || role]}`}>{ROLES[u.role || role]}</span> },
    { label: "College",     value: college ? <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{college.label}</span> : <span className="text-gray-400 text-xs">Not assigned</span> },
    { label: "Status",      value: <StatusBadge active={u.is_active} /> },
    { label: "User ID",     value: <span className="font-mono text-xs text-gray-400">{u.id}</span> },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Faculty Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Avatar + name hero */}
        <div className="px-6 py-5 flex items-center gap-4 bg-gradient-to-br from-indigo-50 to-white border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-indigo-600">
              {(u.full_name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-800 truncate">{u.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{u.email}</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-400 shrink-0 w-24">{row.label}</span>
              <span className="text-sm text-gray-700 text-right">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button onClick={onEdit}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffTab({ role, fetchUrl, onCount }) {
  const { data: fetched, loading } = useApi(fetchUrl);
  const [localList, setLocalList] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [confirmActivate, setConfirmActivate] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const rawUsers = localList ?? fetched ?? [];
  const users = search.trim()
    ? rawUsers.filter(u =>
        (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.college || "").toLowerCase().includes(search.toLowerCase())
      )
    : rawUsers;

  useEffect(() => { setPage(1); }, [fetchUrl, search]);
  useEffect(() => { if (fetched !== undefined) onCount(fetched?.length ?? 0); }, [fetched]);

  const handleDeactivate = async (userId) => {
    setDeactivatingId(userId);
    try {
      await api.delete(`/users/${userId}`);
      setLocalList(rawUsers.map(u => u.id === userId ? { ...u, is_active: false } : u));
      setToast({ message: `${ROLES[role]} deactivated`, type: "success" });
    } catch { setToast({ message: "Failed to deactivate", type: "error" }); }
    finally { setDeactivatingId(null); setConfirmDeactivate(null); }
  };

  const handleActivate = async (userId) => {
    setActivatingId(userId);
    try {
      await api.put(`/users/${userId}`, { is_active: true });
      setLocalList(rawUsers.map(u => u.id === userId ? { ...u, is_active: true } : u));
      setToast({ message: `${ROLES[role]} activated`, type: "success" });
    } catch { setToast({ message: "Failed to activate", type: "error" }); }
    finally { setActivatingId(null); setConfirmActivate(null); }
  };

  const handleSaved = (updated) => {
    setLocalList(rawUsers.map(u => u.id === updated.id ? { ...u, ...updated } : u));
    setToast({ message: "Profile updated", type: "success" });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAdd(true)}
            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shrink-0">
            + Add {ROLES[role]}
          </button>
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search by name, email, or college…`}
              className="w-full border border-gray-300 rounded pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {loading ? "Loading..." : `${users.length} record${users.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">College / Institute</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && rawUsers.length === 0
              ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              : users.length === 0
              ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <svg className="mx-auto w-10 h-10 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="text-sm text-gray-400 mb-3">
                    {search ? `No ${ROLES[role].toLowerCase()}s match "${search}".` : `No ${ROLES[role].toLowerCase()}s yet.`}
                  </p>
                  {!search && (
                    <button onClick={() => setShowAdd(true)}
                      className="inline-flex items-center gap-1 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
                      + Add the first {ROLES[role].toLowerCase()}
                    </button>
                  )}
                </td></tr>
              )
              : users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u, i) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-700">{u.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role || role]}`}>
                      {ROLES[u.role || role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.college
                      ? <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{u.college}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge active={u.is_active} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {/* View profile */}
                      <button onClick={() => setViewUser(u)} title="View profile"
                        className="text-gray-300 hover:text-indigo-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {/* Edit */}
                      <button onClick={() => setEditUser(u)} title="Edit"
                        className="text-gray-300 hover:text-indigo-600 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Activate / Deactivate */}
                      {u.is_active
                        ? <button onClick={() => setConfirmDeactivate(u)} disabled={deactivatingId === u.id}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                            {deactivatingId === u.id ? "…" : "Deactivate"}
                          </button>
                        : <button onClick={() => setConfirmActivate(u)} disabled={activatingId === u.id}
                            className="text-xs text-green-600 hover:text-green-700 transition-colors disabled:opacity-50">
                            {activatingId === u.id ? "…" : "Activate"}
                          </button>
                      }
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
        {users.length > PAGE_SIZE && (
          <Pagination page={page} total={users.length} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </div>

      {showAdd && (
        <AddUserModal role={role} onClose={() => setShowAdd(false)}
          onCreated={u => { setLocalList([...rawUsers, u]); setToast({ message: `${u.full_name} added`, type: "success" }); }} />
      )}
      {viewUser && (
        <ViewProfileModal
          user={viewUser}
          role={role}
          onClose={() => setViewUser(null)}
          onEdit={() => { setEditUser(viewUser); setViewUser(null); }}
        />
      )}
      {editUser && (
        <StaffEditModal
          user={editUser}
          role={role}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}
      {confirmDeactivate && (
        <ConfirmModal
          title={`Deactivate ${ROLES[role]}`}
          message={`Are you sure you want to deactivate ${confirmDeactivate.full_name}? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => handleDeactivate(confirmDeactivate.id)}
          onCancel={() => setConfirmDeactivate(null)}
        />
      )}
      {confirmActivate && (
        <ConfirmModal
          title={`Activate ${ROLES[role]}`}
          message={`Activate ${confirmActivate.full_name}? They will regain access to the system.`}
          confirmLabel="Activate"
          onConfirm={() => handleActivate(confirmActivate.id)}
          onCancel={() => setConfirmActivate(null)}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

const TABS_ADMIN = [
  { key: "students", label: "Students" },
  { key: "instructors", label: "Instructors" },
  { key: "admins", label: "Admins" },
  { key: "program_directors", label: "Program Directors" },
  { key: "deans", label: "Deans" },
  { key: "vp_academic_affairs", label: "VP Academic Affairs" },
];
const TABS_INSTRUCTOR = [{ key: "students", label: "Students" }];

export default function UserManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const tabs = isAdmin ? TABS_ADMIN : TABS_INSTRUCTOR;
  const [activeTab, setActiveTab] = useState("students");
  const [counts, setCounts] = useState({ students: null, instructors: null, admins: null, program_directors: null, deans: null, vp_academic_affairs: null });

  const setStudentCount = useCallback(n => setCounts(c => ({ ...c, students: n })), []);
  const setInstructorCount = useCallback(n => setCounts(c => ({ ...c, instructors: n })), []);
  const setAdminCount = useCallback(n => setCounts(c => ({ ...c, admins: n })), []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage students, instructors, and administrators</p>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
              {counts[t.key] !== null && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${activeTab === t.key ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "students" && <StudentsTab isAdmin={isAdmin} onCount={setStudentCount} />}
        {activeTab === "instructors" && isAdmin && <StaffTab role="instructor" fetchUrl="/users/instructors" onCount={setInstructorCount} />}
        {activeTab === "admins" && isAdmin && <StaffTab role="admin" fetchUrl="/users/admins" onCount={setAdminCount} />}
        {activeTab === "program_directors" && isAdmin && <StaffTab role="program_director" fetchUrl="/users/program-directors" onCount={() => {}} />}
        {activeTab === "deans" && isAdmin && <StaffTab role="dean" fetchUrl="/users/deans" onCount={() => {}} />}
        {activeTab === "vp_academic_affairs" && isAdmin && <StaffTab role="vp_academic_affairs" fetchUrl="/users/vp-academic-affairs" onCount={() => {}} />}
      </div>
    </Layout>
  );
}
