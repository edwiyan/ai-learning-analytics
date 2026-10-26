import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { useApi } from "../hooks/useApi";
import api from "../services/api";

const STATUS_OPTIONS = [
  { key: "present",  label: "P", title: "Present",  bg: "bg-green-500",  ring: "ring-green-500",  text: "text-green-700",  pill: "bg-green-100 text-green-700" },
  { key: "absent",   label: "A", title: "Absent",   bg: "bg-red-500",    ring: "ring-red-500",    text: "text-red-700",    pill: "bg-red-100 text-red-700" },
  { key: "late",     label: "L", title: "Late",     bg: "bg-amber-500",  ring: "ring-amber-500",  text: "text-amber-700",  pill: "bg-amber-100 text-amber-700" },
  { key: "excused",  label: "E", title: "Excused",  bg: "bg-blue-500",   ring: "ring-blue-500",   text: "text-blue-700",   pill: "bg-blue-100 text-blue-700" },
];

function StatusButton({ value, selected, onChange }) {
  const opt = STATUS_OPTIONS.find(o => o.key === value) ?? STATUS_OPTIONS[0];
  return (
    <button
      type="button"
      onClick={onChange}
      title={opt.title}
      className={`w-8 h-8 rounded-full text-xs font-bold text-white transition-all shadow-sm
        ${selected ? `${opt.bg} ring-2 ring-offset-1 ${opt.ring} scale-110` : "bg-gray-200 text-gray-500 hover:bg-gray-300"}`}
    >
      {opt.label}
    </button>
  );
}

function StatusCyclor({ status, onChange }) {
  const idx = STATUS_OPTIONS.findIndex(o => o.key === status);
  const cfg = STATUS_OPTIONS[idx] ?? STATUS_OPTIONS[0];

  return (
    <div className="flex items-center gap-1">
      {STATUS_OPTIONS.map(opt => (
        <StatusButton
          key={opt.key}
          value={opt.key}
          selected={status === opt.key}
          onChange={() => onChange(opt.key)}
        />
      ))}
    </div>
  );
}

export default function AttendancePage() {
  const { data: courses, loading: loadingCourses } = useApi("/analytics/instructor/course-summaries");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const { data: students, loading: loadingStudents } = useApi(
    selectedCourseId ? `/analytics/courses/${selectedCourseId}/students?limit=200` : null,
    [selectedCourseId]
  );

  const { data: existingRecords } = useApi(
    selectedCourseId && date ? `/attendance/${selectedCourseId}?date=${date}` : null,
    [selectedCourseId, date]
  );

  useEffect(() => {
    if (!students?.data) return;
    const base = {};
    students.data.forEach(s => { base[s.student_id_hash] = "present"; });
    setEntries(prev => {
      const merged = { ...base };
      Object.keys(base).forEach(h => {
        if (prev[h]) merged[h] = prev[h];
      });
      return merged;
    });
  }, [students]);

  useEffect(() => {
    if (!existingRecords?.length) return;
    setEntries(prev => {
      const updated = { ...prev };
      existingRecords.forEach(r => { updated[r.student_id_hash] = r.status; });
      return updated;
    });
  }, [existingRecords]);

  const handleSave = async () => {
    if (!selectedCourseId || !date) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const records = Object.entries(entries).map(([student_id_hash, status]) => ({
        student_id_hash,
        status,
      }));
      await api.post(`/attendance/${selectedCourseId}/bulk`, { date, records });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const counts = STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.key] = Object.values(entries).filter(s => s === opt.key).length;
    return acc;
  }, {});

  const studentList = students?.data ?? [];
  const selectedCourse = (courses ?? []).find(c => c.course_id === selectedCourseId);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record and manage student attendance per session</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Course</label>
            {loadingCourses ? (
              <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select a course —</option>
                {(courses ?? []).map(c => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} — {c.course_title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Session Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {!selectedCourseId ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl py-16 text-center text-sm text-gray-400">
            Select a course to start recording attendance.
          </div>
        ) : loadingStudents ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400 animate-pulse">
            Loading student roster…
          </div>
        ) : !studentList.length ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl py-12 text-center text-sm text-amber-600">
            No students found for this course. Upload assessment scores first.
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${opt.pill} border-transparent`}>
                  <span className={`w-4 h-4 rounded-full ${opt.bg} text-white text-xs font-bold flex items-center justify-center`}>{opt.label}</span>
                  {opt.title}: {counts[opt.key]}
                </div>
              ))}
              <div className="ml-auto text-xs text-gray-400 self-center">
                {studentList.length} student{studentList.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Roster table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  {selectedCourse?.course_code} · {date}
                </p>
                <div className="flex gap-1.5 text-xs text-gray-400">
                  {STATUS_OPTIONS.map(o => (
                    <span key={o.key} className="flex items-center gap-0.5">
                      <span className={`w-3 h-3 rounded-full ${o.bg}`} />{o.title}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                      <th className="px-5 py-2.5 text-left w-6">#</th>
                      <th className="px-5 py-2.5 text-left">Student</th>
                      <th className="px-5 py-2.5 text-left">Student No.</th>
                      <th className="px-5 py-2.5 text-left">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentList.map((s, i) => (
                      <tr key={s.student_id_hash} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800">{s.full_name}</p>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">
                          {s.student_number ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <StatusCyclor
                            status={entries[s.student_id_hash] ?? "present"}
                            onChange={status =>
                              setEntries(prev => ({ ...prev, [s.student_id_hash]: status }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 justify-end">
                {error && <p className="text-xs text-red-600 flex-1">{error}</p>}
                {saved && <p className="text-xs text-green-600 flex-1">Attendance saved!</p>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving…" : "Save Attendance"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
