import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../services/api";
import { useApi } from "../hooks/useApi";
import { openResourceFile } from "../utils/resourceFile";

const TYPE_STYLES = {
  video: "bg-red-50 text-red-700",
  reading: "bg-blue-50 text-blue-700",
  exercise: "bg-green-50 text-green-700",
  lesson: "bg-purple-50 text-purple-700",
  link: "bg-sky-50 text-sky-700",
  file: "bg-amber-50 text-amber-700",
};
const TYPE_OPTIONS = [
  { value: "link", label: "Link" },
  { value: "lesson", label: "Lesson" },
  { value: "video", label: "Video" },
  { value: "reading", label: "Reading" },
  { value: "exercise", label: "Exercise" },
  { value: "file", label: "File (PDF, PPT, DOCX…)" },
];
const TABS = [
  { key: "suggested", label: "Suggestions" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];
const FILE_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.mp4";
const EMPTY_FORM = { title: "", type: "link", url: "", description: "", competencyIds: [], file: null };

function ResourceCard({ item, onDecide, onRemove, busy, aiAvailable }) {
  const r = item.resource;
  const fromInstructor = item.source === "instructor";
  return (
    <div className="border border-gray-200 rounded-lg p-3 flex gap-3 items-start bg-white">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium capitalize ${TYPE_STYLES[r.type] || "bg-gray-100 text-gray-600"}`}>{r.type}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${fromInstructor ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
            {fromInstructor ? "Added by you" : aiAvailable ? "AI suggestion" : "Keyword match"}
          </span>
          {!fromInstructor && item.score != null && (
            <span className="text-[11px] text-gray-400">{Math.round(item.score * 100)}% relevance</span>
          )}
        </div>
        {r.has_file ? (
          <button onClick={() => openResourceFile(r)} className="text-sm font-medium text-indigo-700 hover:underline text-left">
            {r.title} <span className="text-xs text-gray-400">({r.file_name})</span>
          </button>
        ) : (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-700 hover:underline break-words">{r.title}</a>
        )}
        {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
        {item.reason && !fromInstructor && <p className="text-xs text-gray-500 italic">{item.reason}</p>}
        {(r.helpful_count > 0 || r.not_helpful_count > 0) && (
          <p className="text-[11px] text-gray-400">Students: 👍 {r.helpful_count} · 👎 {r.not_helpful_count}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {item.status !== "accepted" && (
          <button disabled={busy} onClick={() => onDecide(item, "accepted")}
            className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">Accept</button>
        )}
        {item.status !== "declined" && !fromInstructor && (
          <button disabled={busy} onClick={() => onDecide(item, "declined")}
            className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">Decline</button>
        )}
        {item.status !== "suggested" && !fromInstructor && (
          <button disabled={busy} onClick={() => onDecide(item, "suggested")}
            className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">Undo</button>
        )}
        {fromInstructor && (
          <button disabled={busy} onClick={() => onRemove(item)}
            className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Remove</button>
        )}
      </div>
    </div>
  );
}

function AddResourceForm({ competencies, onSubmit, busy }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.title.trim().length < 3) { setError("Give the resource a title (at least 3 characters)."); return; }
    if (!form.url.trim() && !form.file) { setError("Add a link or choose a file."); return; }
    if (form.file && form.file.size > 25 * 1024 * 1024) { setError("Files can be up to 25 MB."); return; }
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("type", form.type);
    fd.append("competency_ids", form.competencyIds.join(","));
    if (form.url.trim()) fd.append("url", form.url.trim());
    if (form.description.trim()) fd.append("description", form.description.trim());
    if (form.file) fd.append("file", form.file);
    const ok = await onSubmit(fd, setError);
    if (ok) setForm(EMPTY_FORM);
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Add your own resource</h2>
        <p className="text-xs text-gray-500">A link, a lesson, or a file (PDF, PowerPoint, Word, Excel, image or video, up to 25 MB). It is accepted for your course right away.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Title"
          className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={form.type} onChange={e => set("type", e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://… (optional if you upload a file)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-600">
          {form.file ? `📎 ${form.file.name}` : "Choose file…"}
          <input type="file" accept={FILE_ACCEPT} className="hidden" onChange={e => set("file", e.target.files?.[0] || null)} />
        </label>
        {form.file && <button type="button" onClick={() => set("file", null)} className="text-xs text-gray-500 hover:underline">Clear file</button>}
      </div>
      <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2}
        placeholder="Short note for students (optional)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">Competencies it helps with</p>
        <div className="flex flex-wrap gap-1.5">
          {competencies.map(c => {
            const on = form.competencyIds.includes(c.id);
            return (
              <button type="button" key={c.id}
                onClick={() => set("competencyIds", on ? form.competencyIds.filter(x => x !== c.id) : [...form.competencyIds, c.id])}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${on ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                {c.competency_code} · {c.topic_name}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">Leave empty to offer it for every competency in the course.</p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button disabled={busy} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {busy ? "Saving…" : "Add resource"}
      </button>
    </form>
  );
}

export default function CourseResourcesPage() {
  const { data: courses } = useApi("/courses/");
  const [courseId, setCourseId] = useState("");
  const [view, setView] = useState(null);
  const [tab, setTab] = useState("suggested");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const activeCourse = courseId || courses?.[0]?.id || "";

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    if (!activeCourse) return;
    let cancelled = false;
    api.get(`/courses/${activeCourse}/resources`)
      .then(r => { if (!cancelled) setView(r.data); })
      .catch(() => { if (!cancelled) setView(null); });
    return () => { cancelled = true; };
  }, [activeCourse]);

  const reload = async () => setView((await api.get(`/courses/${activeCourse}/resources`)).data);

  const suggest = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/courses/${activeCourse}/resources/suggest`);
      setView(res.data);
      setTab("suggested");
      const s = res.data.summary;
      showToast(s.new_suggestions ? `${s.new_suggestions} new suggestion${s.new_suggestions === 1 ? "" : "s"}` : "No new suggestions — the repository has nothing else matching");
    } catch (err) { showToast(err.response?.data?.detail || "Could not get suggestions", "error"); }
    finally { setBusy(false); }
  };

  const decide = async (item, status) => {
    setBusy(true);
    try {
      await api.put(`/courses/${activeCourse}/resources/${item.link_id}`, { status });
      await reload();
    } catch (err) { showToast(err.response?.data?.detail || "Update failed", "error"); }
    finally { setBusy(false); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.resource.title}"?`)) return;
    setBusy(true);
    try { await api.delete(`/courses/${activeCourse}/resources/${item.link_id}`); await reload(); showToast("Resource removed"); }
    catch (err) { showToast(err.response?.data?.detail || "Remove failed", "error"); }
    finally { setBusy(false); }
  };

  const add = async (formData, setError) => {
    setBusy(true);
    try {
      const res = await api.post(`/courses/${activeCourse}/resources`, formData);
      setView(res.data); setTab("accepted"); showToast("Resource added");
      return true;
    } catch (err) { setError(err.response?.data?.detail || "Could not add the resource"); return false; }
    finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const c = { suggested: 0, accepted: 0, declined: 0 };
    (view?.items || []).forEach(i => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [view]);

  const groups = useMemo(() => {
    if (!view) return [];
    const items = view.items.filter(i => i.status === tab);
    const byComp = view.competencies.map(c => ({ comp: c, items: items.filter(i => i.competency_id === c.id) }));
    const general = items.filter(i => !i.competency_id);
    if (general.length) byComp.push({ comp: { id: "all", competency_code: "All", topic_name: "Every competency in the course" }, items: general });
    return byComp.filter(g => g.items.length);
  }, [view, tab]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Course Review Resources</h1>
            <p className="text-sm text-gray-500 mt-0.5">Accept or decline the suggested review materials for each competency, and add your own. Students weak in a competency see your accepted resources first; declined ones are never shown.</p>
          </div>
          <select value={activeCourse} onChange={e => { setCourseId(e.target.value); setView(null); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-64">
            {(courses || []).map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>

        {toast && (
          <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${toast.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>{toast.msg}</div>
        )}

        {view && !view.has_validated_syllabus ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            This course has no endorsed syllabus yet. Resources are suggested per competency once the syllabus is endorsed.
          </div>
        ) : view && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">{view.competencies.length}</span> competencies ·{" "}
                <span className="font-medium text-gray-800">{counts.accepted}</span> accepted ·{" "}
                <span className="font-medium text-gray-800">{counts.suggested}</span> waiting for review
                {!view.ai_available && <span className="block text-xs text-amber-600 mt-0.5">AI service not configured — suggestions use keyword matching against the resource repository.</span>}
              </div>
              <button disabled={busy} onClick={suggest}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "Working…" : view.ai_available ? "✨ Get AI suggestions" : "Find matching resources"}
              </button>
            </div>

            <div className="flex gap-1 border-b border-gray-200">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === t.key ? "border-indigo-600 text-indigo-700 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {t.label} <span className="text-xs text-gray-400">({counts[t.key] || 0})</span>
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {tab === "suggested" ? "No suggestions waiting. Click the button above to look for more." : `No ${tab} resources yet.`}
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map(g => (
                  <section key={g.comp.id} className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="font-mono text-indigo-600">{g.comp.competency_code}</span> · {g.comp.topic_name}
                    </h3>
                    {g.items.map(item => (
                      <ResourceCard key={item.link_id} item={item} busy={busy} aiAvailable={view.ai_available} onDecide={decide} onRemove={remove} />
                    ))}
                  </section>
                ))}
              </div>
            )}

            <AddResourceForm competencies={view.competencies} onSubmit={add} busy={busy} />
          </>
        )}
      </div>
    </Layout>
  );
}
