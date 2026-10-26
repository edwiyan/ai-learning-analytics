import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

const TYPE_LABELS = { multiple_choice: "Multiple Choice", short_answer: "Short Answer", problem: "Problem Solving" };
const PART_ORDER = ["multiple_choice", "short_answer", "problem"];
const DEFAULT_POINTS = { multiple_choice: 1, short_answer: 5, problem: 10 };
const BLOOM_LEVELS = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];
const EMPTY_DRAFT = { question_text: "", question_type: "short_answer", choices: ["", "", "", ""], answer_key: "", points: 5, competency_id: "", bloom_level: "" };

async function download(url, fallbackName) {
  const res = await api.get(url, { responseType: "blob" });
  const match = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(res.data),
    download: match ? match[1] : fallbackName,
  });
  a.click();
  // Revoking synchronously can cancel the download before the browser starts it
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function QuestionEditor({ initial, competencies, onSave, onCancel, saving }) {
  const [d, setD] = useState(() => ({
    ...EMPTY_DRAFT, ...initial,
    choices: initial?.choices?.length ? [...initial.choices] : ["", "", "", ""],
    competency_id: initial?.competency_id || "",
    bloom_level: initial?.bloom_level || "",
    answer_key: initial?.answer_key || "",
  }));
  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));
  const isMcq = d.question_type === "multiple_choice";
  const inputCls = "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500";

  const submit = () => onSave({
    question_text: d.question_text.trim(),
    question_type: d.question_type,
    choices: isMcq ? d.choices.map(c => c.trim()).filter(Boolean) : null,
    answer_key: d.answer_key.trim() || null,
    points: Number(d.points) || 1,
    competency_id: d.competency_id || null,
    bloom_level: d.bloom_level || null,
  });

  return (
    <div className="space-y-2 bg-indigo-50/40 border border-indigo-100 rounded-lg p-3">
      <textarea rows={3} value={d.question_text} onChange={e => set("question_text", e.target.value)}
        placeholder="Question text" className={inputCls} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={d.question_type} onChange={e => { set("question_type", e.target.value); set("points", DEFAULT_POINTS[e.target.value]); }} className={inputCls}>
          {PART_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select value={d.competency_id} onChange={e => set("competency_id", e.target.value)} className={inputCls}>
          <option value="">No competency</option>
          {(competencies || []).map(c => <option key={c.id} value={c.id}>{c.competency_code} — {c.topic_name}</option>)}
        </select>
        <select value={d.bloom_level} onChange={e => set("bloom_level", e.target.value)} className={inputCls}>
          <option value="">Bloom's level</option>
          {BLOOM_LEVELS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="relative">
          <input type="number" min={0.5} step={0.5} value={d.points} onChange={e => set("points", e.target.value)} className={`${inputCls} pr-8`} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">pts</span>
        </div>
      </div>
      {isMcq && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {d.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 w-4">{String.fromCharCode(65 + i)}.</span>
              <input value={c} onChange={e => set("choices", d.choices.map((x, j) => j === i ? e.target.value : x))} className={inputCls} />
            </div>
          ))}
        </div>
      )}
      <input value={d.answer_key} onChange={e => set("answer_key", e.target.value)}
        placeholder={isMcq ? "Correct letter (e.g. B)" : "Model answer or rubric (shown only on the answer key)"} className={inputCls} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="button" onClick={submit} disabled={saving || d.question_text.trim().length < 3}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function ExamQuestionsPanel({ assessment, courseId }) {
  const [questions, setQuestions] = useState([]);
  const [locked, setLocked] = useState(false);
  const [competencies, setCompetencies] = useState([]);
  const [tos, setTos] = useState([]);
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState(2);
  const [qType, setQType] = useState("mixed");
  const [selected, setSelected] = useState(null); // null = all competencies
  const [useTos, setUseTos] = useState(true);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(null); // question id, "new", or null
  const [error, setError] = useState("");

  const load = useCallback(() => Promise.all([
    api.get(`/assessments/${assessment.id}/questions`),
    api.get(`/syllabi/courses/${courseId}/competencies`).catch(() => ({ data: [] })),
    api.get(`/assessments/${assessment.id}/tos`).catch(() => ({ data: [] })),
  ]).then(([qRes, cRes, tRes]) => {
    setQuestions(qRes.data.questions);
    setLocked(qRes.data.locked);
    setCompetencies([...(cRes.data || [])].sort((a, b) => a.competency_code.localeCompare(b.competency_code, undefined, { numeric: true })));
    setTos(tRes.data.filter(t => t.item_count > 0));
  }).catch(err => setError(err?.response?.data?.detail || "Could not load exam questions.")),
  [assessment.id, courseId]);

  useEffect(() => { load(); }, [load]);

  const tosItems = tos.reduce((s, t) => s + t.item_count, 0);
  const followTos = useTos && tos.length > 0;
  const selectedIds = selected ?? competencies.map(c => c.id);
  const toggle = id => setSelected(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const plannedCount = followTos ? tosItems : selectedIds.length * count;

  const generate = async () => {
    if (questions.length && !window.confirm(`Replace the ${questions.length} existing question(s) with newly generated ones?`)) return;
    setBusy("generate"); setError(""); setEditing(null);
    try {
      const res = await api.post(`/assessments/${assessment.id}/questions/generate`, {
        competency_ids: followTos ? null : selectedIds,
        count_per_competency: count,
        question_type: qType,
        use_tos: followTos,
        replace: true,
      });
      setQuestions(res.data.questions);
      setLocked(res.data.locked);
    } catch (err) {
      setError(err?.response?.data?.detail || "Generation failed.");
    } finally { setBusy(""); }
  };

  const save = async (payload) => {
    setBusy("save"); setError("");
    try {
      if (editing === "new") await api.post(`/assessments/${assessment.id}/questions`, payload);
      else await api.put(`/assessments/questions/${editing}`, payload);
      setEditing(null);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not save the question.");
    } finally { setBusy(""); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api.delete(`/assessments/questions/${id}`);
      setQuestions(qs => qs.filter(q => q.id !== id));
    } catch (err) { setError(err?.response?.data?.detail || "Could not delete the question."); }
  };

  const exportFile = async (kind) => {
    setBusy(kind); setError("");
    try {
      if (kind === "sheet") await download(`/assessments/${assessment.id}/questions/export/score-sheet`, "score_sheet.csv");
      else await download(`/assessments/${assessment.id}/questions/export/docx?answer_key=${kind === "key"}`, kind === "key" ? "answer_key.docx" : "exam.docx");
    } catch { setError("Download failed."); }
    finally { setBusy(""); }
  };

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const source = questions.some(q => q.source === "template") ? "template" : questions.some(q => q.source === "ai") ? "ai" : null;
  // Numbered by part, matching the printed exam
  const numberOf = Object.fromEntries(
    PART_ORDER.flatMap(t => questions.filter(q => q.question_type === t)).map((q, i) => [q.id, i + 1])
  );

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-md p-6 space-y-4 mb-4">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-left">
        <div>
          <h2 className="text-base font-semibold text-gray-700">Exam Questions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Draft questions from your syllabus, print the exam, and get a score sheet already tagged with competency codes.
            Students answer on paper (or another platform) — not inside AILAS.
          </p>
        </div>
        <span className="shrink-0 ml-3 text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
          {questions.length} items · {totalPoints} pts {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <>
          {locked && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Scores have been uploaded for this assessment, so its questions are locked. You can still download the exam and answer key.
            </p>
          )}

          {!locked && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
              {tos.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={useTos} onChange={e => setUseTos(e.target.checked)} />
                  Follow my Table of Specifications ({tosItems} items across {tos.length} competenc{tos.length === 1 ? "y" : "ies"}, with their Bloom's levels)
                </label>
              )}
              {!followTos && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Competencies to cover</p>
                  {competencies.length === 0 ? (
                    <p className="text-xs text-amber-600">This course has no validated syllabus competencies yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {competencies.map(c => (
                        <button type="button" key={c.id} onClick={() => toggle(c.id)} title={c.topic_name}
                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedIds.includes(c.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-indigo-300"}`}>
                          {c.competency_code}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                {!followTos && (
                  <label className="text-xs text-gray-600">Per competency
                    <select value={count} onChange={e => setCount(Number(e.target.value))}
                      className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs text-gray-600">Question type
                  <select value={qType} onChange={e => setQType(e.target.value)}
                    className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                    <option value="mixed">Mixed</option>
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="short_answer">Short answer</option>
                    <option value="problem">Problem solving</option>
                  </select>
                </label>
                <button type="button" onClick={generate} disabled={busy === "generate" || plannedCount === 0}
                  className="ml-auto px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {busy === "generate" ? "Generating…" : `Generate ${plannedCount} question${plannedCount === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          )}

          {source === "template" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              AI is not configured, so these are drafts built from your syllabus learning outcomes (short-answer only).
              Review and edit each one before printing. Add a real OpenAI key to get AI-written questions, including multiple choice.
            </p>
          )}
          {source === "ai" && (
            <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              AI-drafted questions — check accuracy and answer keys before giving the exam.
            </p>
          )}

          {PART_ORDER.map(type => {
            const part = questions.filter(q => q.question_type === type);
            if (!part.length) return null;
            return (
              <div key={type} className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {TYPE_LABELS[type]} · {part.reduce((s, q) => s + q.points, 0)} pts
                </p>
                {part.map(q => {
                  if (editing === q.id) {
                    return <QuestionEditor key={q.id} initial={q} competencies={competencies} saving={busy === "save"}
                      onSave={save} onCancel={() => setEditing(null)} />;
                  }
                  return (
                    <div key={q.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-400 mt-0.5 w-5 shrink-0">{numberOf[q.id]}.</span>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm text-gray-800">{q.question_text}</p>
                          {q.choices?.length > 0 && (
                            <ol className="text-xs text-gray-600 space-y-0.5">
                              {q.choices.map((c, i) => {
                                const letter = String.fromCharCode(65 + i);
                                const correct = (q.answer_key || "").trim().toUpperCase().startsWith(letter);
                                return <li key={i} className={correct ? "text-green-700 font-medium" : ""}>{letter}. {c}</li>;
                              })}
                            </ol>
                          )}
                          {q.answer_key && q.question_type !== "multiple_choice" && (
                            <p className="text-xs text-gray-500"><span className="font-medium">Answer key:</span> {q.answer_key}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {q.competency_code && <span className="text-[11px] font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded" title={q.topic_name}>{q.competency_code}</span>}
                            {q.bloom_level && <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{q.bloom_level}</span>}
                            <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{q.points} pt{q.points === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                        {!locked && busy !== "generate" && (
                          <div className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => setEditing(q.id)} className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">Edit</button>
                            <button type="button" onClick={() => remove(q.id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {editing === "new" && (
            <QuestionEditor initial={null} competencies={competencies} saving={busy === "save"}
              onSave={save} onCancel={() => setEditing(null)} />
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            {!locked && editing !== "new" && (
              <button type="button" onClick={() => setEditing("new")}
                className="px-3 py-2 text-xs font-medium border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50">
                + Add question
              </button>
            )}
            <div className="flex flex-wrap gap-2 ml-auto">
              {[["exam", "Exam (DOCX)"], ["key", "Answer key (DOCX)"], ["sheet", "Score sheet (CSV)"]].map(([kind, label]) => (
                <button type="button" key={kind} onClick={() => exportFile(kind)} disabled={!questions.length || busy === kind}
                  className="px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  {busy === kind ? "Preparing…" : `⬇ ${label}`}
                </button>
              ))}
            </div>
          </div>
          {questions.length > 0 && (
            <p className="text-xs text-gray-400">
              After the exam, fill in each student's number and score in the score sheet, then upload it below — every question is already tagged, so no topic mapping is needed.
            </p>
          )}
        </>
      )}
    </div>
  );
}
