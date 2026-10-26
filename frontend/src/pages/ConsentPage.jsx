import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function ConsentPage() {
  const { user, updateConsentStatus, logout } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [showDeclineInfo, setShowDeclineInfo] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await api.post("/consent/accept");
      await updateConsentStatus();
      navigate("/student");
    } catch {
      setError("Failed to record your consent. Please try again.");
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-indigo-600 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Data Privacy Consent</h1>
              <p className="text-indigo-200 text-xs mt-0.5">Republic Act No. 10173 — Data Privacy Act of 2012</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            Welcome, <strong>{user?.full_name || "Student"}</strong>. Before you can access your academic
            analytics, we are required by the <strong>Philippine Data Privacy Act of 2012 (RA 10173)</strong> to
            inform you of how your personal data is collected and used, and to obtain your informed consent.
          </p>

          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">What data we collect</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                "Assessment scores and grade records submitted by your instructors",
                "Course enrollment and academic period information",
                "Attendance records logged by your instructor",
                "Competency performance derived from your assessment results",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <h2 className="text-sm font-semibold text-gray-800 pt-2">How it is used</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                "Generate academic risk assessments (At-Risk, On-Track, Excelling) to support early intervention",
                "Identify weak competency areas and surface personalized remedial resources",
                "Support your instructor in providing timely academic guidance",
                "Produce anonymized institution-wide reports for program quality improvement",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <h2 className="text-sm font-semibold text-gray-800 pt-2">Your rights under RA 10173</h2>
            <p className="text-sm text-gray-600">
              You have the right to access, correct, and request deletion of your personal data.
              Your student ID is stored as a one-way SHA-256 hash — it cannot be reversed.
              Data is retained only for the duration of your enrollment and up to five years after,
              as required by CHED academic record retention policies.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              By clicking <strong>I Agree</strong>, you confirm that you have read and understood this
              notice, and you consent to the collection and processing of your academic data as described
              above for the purposes of the AILAS system at Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH).
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}

          {/* Decline info panel */}
          {showDeclineInfo && (
            <div className="bg-gray-100 border border-gray-200 rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-800">If you decline</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Your account will remain active but you will not be able to view your academic analytics,
                competency scores, risk status, or study recommendations until consent is given.
                You may log in again at any time to review this notice and accept.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleDecline}
                  className="flex-1 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Decline and log out
                </button>
                <button
                  onClick={() => setShowDeclineInfo(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!showDeclineInfo && (
          <div className="px-8 pb-8 flex gap-3">
            <button
              onClick={() => setShowDeclineInfo(true)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              I do not agree
            </button>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {accepting ? "Recording consent…" : "I Agree"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
