import { useState } from "react";
import Layout from "../components/Layout";
import api from "../services/api";

const SUS_QUESTIONS = [
  { id: "q1",  text: "I think that I would like to use this system frequently.",                              positive: true },
  { id: "q2",  text: "I found the system unnecessarily complex.",                                            positive: false },
  { id: "q3",  text: "I thought the system was easy to use.",                                               positive: true },
  { id: "q4",  text: "I think that I would need the support of a technical person to use this system.",     positive: false },
  { id: "q5",  text: "I found the various functions in this system were well integrated.",                  positive: true },
  { id: "q6",  text: "I thought there was too much inconsistency in this system.",                          positive: false },
  { id: "q7",  text: "I would imagine that most people would learn to use this system very quickly.",       positive: true },
  { id: "q8",  text: "I found the system very cumbersome to use.",                                          positive: false },
  { id: "q9",  text: "I felt very confident using the system.",                                             positive: true },
  { id: "q10", text: "I needed to learn a lot of things before I could get going with this system.",        positive: false },
];

const SCALE_LABELS = {
  1: "Strongly Disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly Agree",
};

const RATING_CONFIG = {
  Excellent: { color: "text-green-600", bg: "bg-green-50 border-green-200", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  Good:      { color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",   icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  OK:        { color: "text-indigo-600",bg: "bg-indigo-50 border-indigo-200",icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  Poor:      { color: "text-amber-600", bg: "bg-amber-50 border-amber-200",  icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" },
  Awful:     { color: "text-red-600",   bg: "bg-red-50 border-red-200",      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
};

function computePreview(responses) {
  let total = 0;
  let answered = 0;
  for (let i = 1; i <= 10; i++) {
    const val = responses[`q${i}`];
    if (val == null) continue;
    answered++;
    total += i % 2 === 1 ? val - 1 : 5 - val;
  }
  if (answered === 0) return null;
  return Math.round((total / answered) * 10 * 2.5);
}

export default function SusSurveyPage() {
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const answered = Object.keys(responses).length;
  const allAnswered = answered === 10;
  const preview = computePreview(responses);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/surveys/sus", { responses });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const score = result.sus_score;
    const rating = score >= 90 ? "Excellent" : score >= 80 ? "Good" : score >= 68 ? "OK" : score >= 51 ? "Poor" : "Awful";
    const cfg = RATING_CONFIG[rating];
    return (
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className={`rounded-2xl border p-8 text-center ${cfg.bg}`}>
            <svg className={`w-12 h-12 mx-auto mb-4 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={cfg.icon} />
            </svg>
            <p className="text-sm text-gray-500 mb-1">Your SUS Score</p>
            <p className={`text-5xl font-bold mb-2 ${cfg.color}`}>{score}</p>
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${cfg.color} bg-white/70 border ${cfg.bg.split(" ")[1]}`}>
              {rating}
            </span>
            <p className="text-xs text-gray-500 mt-4">
              The System Usability Scale rates usability from 0–100. A score ≥ 68 is considered above average.
            </p>
            <p className="text-xs text-gray-400 mt-1">Thank you for completing the survey!</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">System Usability Survey</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Rate your experience using AILAS. Select 1 (Strongly Disagree) to 5 (Strongly Agree) for each statement.
          </p>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${answered * 10}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 shrink-0">{answered}/10 answered</span>
          {preview !== null && (
            <span className="text-xs text-indigo-600 font-medium shrink-0">
              Preview: ~{preview}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {SUS_QUESTIONS.map((q, idx) => (
            <div key={q.id} className={`bg-white rounded-xl border p-4 transition-colors ${
              responses[q.id] ? "border-indigo-200" : "border-gray-200"
            }`}>
              <div className="flex items-start gap-3 mb-3">
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{q.text}</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setResponses(r => ({ ...r, [q.id]: val }))}
                    className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      responses[q.id] === val
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    <span className="text-base font-bold leading-none">{val}</span>
                    <span className="text-center leading-tight hidden sm:block" style={{ fontSize: "0.6rem" }}>
                      {SCALE_LABELS[val].replace(" ", "\n")}
                    </span>
                  </button>
                ))}
              </div>
              {responses[q.id] && (
                <p className="text-xs text-indigo-600 mt-1.5 text-center">
                  {SCALE_LABELS[responses[q.id]]}
                </p>
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={!allAnswered || submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Submitting…" : !allAnswered ? `Answer all questions (${10 - answered} remaining)` : "Submit Survey"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
