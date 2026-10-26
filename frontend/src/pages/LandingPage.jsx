import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_REDIRECTS = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
  program_director: "/program-director",
  dean: "/dean",
  vp_academic_affairs: "/vp",
};

// ── icons ─────────────────────────────────────────────────────────────────────
function Icon({ path, className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const ICONS = {
  brain:      "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  chart:      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  shield:     "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  warning:    "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  book:       "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.75 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  users:      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  sparkle:    "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  arrow:      "M13 7l5 5m0 0l-5 5m5-5H6",
  check:      "M5 13l4 4L19 7",
  lock:       "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  map:        "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  graduation: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222",
};

// ── data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: "brain",
    title: "AI-Powered Topic Mapping",
    desc: "GPT-4o-mini automatically maps assessment questions to syllabus competencies with confidence scoring, flagging low-confidence items for faculty review.",
    color: "indigo",
  },
  {
    icon: "warning",
    title: "Early Risk Detection",
    desc: "Rule-based engine analyzes competency scores, submission timeliness, and grade progression to identify at-risk students before it's too late.",
    color: "amber",
  },
  {
    icon: "sparkle",
    title: "Personalized Interventions",
    desc: "Tag-match recommender surfaces ranked remedial resources — videos, readings, exercises — tailored to each student's specific weak competencies.",
    color: "violet",
  },
  {
    icon: "chart",
    title: "Institution-Wide Analytics",
    desc: "Role-scoped dashboards give admins, deans, and VP academic affairs real-time visibility into enrollment trends, subject performance, and failure rates.",
    color: "sky",
  },
  {
    icon: "book",
    title: "Syllabus & Grade Workflow",
    desc: "End-to-end approval pipelines for syllabi and grade submissions — from instructor upload through program director and dean sign-off.",
    color: "emerald",
  },
  {
    icon: "lock",
    title: "Privacy-First Architecture",
    desc: "Student IDs are SHA-256 hashed before storage. JWT-based RBAC ensures every user sees only the data their role permits.",
    color: "rose",
  },
];

const STATS = [
  { value: "≥ 85%", label: "Topic Mapping Accuracy", sub: "vs faculty-validated ground truth" },
  { value: "≥ 0.80", label: "Risk Prediction F₁", sub: "Rule-based engine" },
  { value: "≤ 3s",  label: "API Response (p95)",   sub: "ISO/IEC 25010 target" },
  { value: "≥ 68",  label: "Target SUS Score",      sub: "above-average usability" },
];

const ROLES = [
  { role: "Student",          icon: "graduation", desc: "Track competencies, view risk status, access personalized learning resources." },
  { role: "Instructor",       icon: "book",       desc: "Upload assessments, monitor class performance, manage syllabi and interventions." },
  { role: "Program Director", icon: "map",        desc: "Approve syllabi and grades, review college-wide subject performance." },
  { role: "Dean",             icon: "shield",     desc: "Oversee college analytics, syllabus compliance, and grade approvals." },
  { role: "VP Academic",      icon: "chart",      desc: "Institution-wide visibility: enrollment trends, failure rates, audit logs." },
  { role: "Admin",            icon: "users",      desc: "Manage users, programs, curricula, and full system configuration." },
];

const COLOR_MAP = {
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  border: "border-indigo-100" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-100"  },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  border: "border-violet-100" },
  sky:     { bg: "bg-sky-50",     icon: "text-sky-600",     border: "border-sky-100"    },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-100"},
  rose:    { bg: "bg-rose-50",    icon: "text-rose-600",    border: "border-rose-100"   },
};

// ── sub-components ────────────────────────────────────────────────────────────
function NavBar() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Icon path={ICONS.sparkle} className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">AILAS</span>
          <span className="hidden sm:inline text-xs text-gray-400 font-medium ml-1">
            Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH)
          </span>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Sign In
          <Icon path={ICONS.arrow} className="w-4 h-4" />
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="absolute -top-24 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-100 opacity-60 blur-3xl pointer-events-none" />
      <div className="absolute top-10 -right-40 w-[500px] h-[500px] rounded-full bg-violet-100 opacity-50 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 text-center">
        <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Icon path={ICONS.sparkle} className="w-3.5 h-3.5" />
          AI-Assisted Learning Analytics
        </span>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
          Catch at-risk students
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            before they fall behind.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-gray-500 leading-relaxed mb-10">
          AILAS maps every assessment to curriculum competencies using AI, predicts academic risk
          in real time, and delivers personalized remedial resources — so no student slips through
          the cracks.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
          >
            Access the System
            <Icon path={ICONS.arrow} className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 text-gray-700 font-semibold text-sm px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
          >
            See Features
          </a>
        </div>

        {/* hero visual */}
        <div className="mt-16 relative max-w-4xl mx-auto">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-indigo-100 overflow-hidden">
            {/* mock browser bar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="w-3 h-3 rounded-full bg-rose-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="flex-1 mx-3 h-5 rounded-md bg-gray-200 text-xs flex items-center px-2 text-gray-400">
                ailas.btech.edu.ph
              </span>
            </div>
            {/* dashboard preview */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-indigo-50 min-h-[260px]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Total Students", val: "1,240", color: "text-indigo-600" },
                  { label: "At-Risk",         val: "87",    color: "text-amber-600"  },
                  { label: "Avg Score",        val: "74.3%", color: "text-emerald-600"},
                  { label: "Active Courses",   val: "38",    color: "text-violet-600" },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <p className={`text-xl font-bold ${c.color}`}>{c.val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-3 shadow-sm h-24 flex flex-col justify-between">
                  <p className="text-xs font-semibold text-gray-600">Enrollment Trend</p>
                  <div className="flex items-end gap-1 h-12">
                    {[40,55,48,62,70,58,75,80,72,88,82,92].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-indigo-200 hover:bg-indigo-400 transition-colors" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm h-24 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-gray-600">Risk Distribution</p>
                  {[
                    { label: "Excelling", pct: 55, color: "bg-emerald-400" },
                    { label: "On-Track",  pct: 30, color: "bg-indigo-400"  },
                    { label: "At-Risk",   pct: 15, color: "bg-amber-400"   },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 w-14 text-right">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 top-12 bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-gray-700">Live analytics</span>
          </div>
          <div className="absolute -left-4 bottom-12 bg-white border border-amber-100 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
            <Icon path={ICONS.warning} className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-gray-700">3 students need attention</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-3 block">Capabilities</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Everything in one platform</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            From raw CSV uploads to AI-powered risk alerts — AILAS covers the full academic analytics lifecycle.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => {
            const c = COLOR_MAP[f.color];
            return (
              <div key={f.title} className={`rounded-2xl border ${c.border} ${c.bg} p-6 flex flex-col gap-4`}>
                <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center ${c.icon}`}>
                  <Icon path={ICONS[f.icon]} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-20 bg-gradient-to-br from-indigo-600 to-violet-700">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Built to quality targets</h2>
          <p className="text-indigo-200 text-sm">ISO/IEC 25010 quality characteristics guide every design decision.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.label} className="bg-white/10 rounded-2xl border border-white/20 p-6 text-center backdrop-blur">
              <p className="text-3xl font-extrabold text-white mb-1">{s.value}</p>
              <p className="text-sm font-semibold text-indigo-100 mb-1">{s.label}</p>
              <p className="text-xs text-indigo-300">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Upload Assessments", desc: "Instructors upload CSV grade sheets. Student IDs are SHA-256 hashed on ingestion for privacy." },
    { n: "02", title: "AI Topic Mapping",   desc: "GPT-4o-mini maps each question to syllabus competencies. Items below 0.75 confidence go to faculty review." },
    { n: "03", title: "Risk Prediction",    desc: "A rule-based engine scores every student — Excelling, On-Track, or At-Risk — using deterministic competency thresholds." },
    { n: "04", title: "Targeted Resources", desc: "Tag-match recommender ranks remedial videos, readings, and exercises per weak competency on each student's dashboard." },
  ];
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-3 block">Workflow</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">How AILAS works</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-indigo-100 z-0 -translate-x-1/2" />
              )}
              <div className="relative z-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <span className="text-4xl font-black text-indigo-100 leading-none block mb-3">{s.n}</span>
                <h3 className="text-sm font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RolesSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-3 block">Access</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Tailored for every stakeholder</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Six distinct roles, each with a purpose-built dashboard showing only the data they need.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLES.map(r => (
            <div key={r.role} className="flex gap-4 p-5 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-100 transition-colors shrink-0">
                <Icon path={ICONS[r.icon]} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{r.role}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 to-indigo-950">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mx-auto mb-6">
          <Icon path={ICONS.sparkle} className="w-7 h-7 text-indigo-300" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
          Ready to transform student outcomes?
        </h2>
        <p className="text-slate-400 mb-10 leading-relaxed">
          Sign in with your BTECH institutional account to access your role-based dashboard.
          Contact your system administrator if you need access.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/login"
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-900 transition-all hover:-translate-y-0.5"
          >
            Sign In to AILAS
            <Icon path={ICONS.arrow} className="w-4 h-4" />
          </Link>
          <Link
            to="/privacy"
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Privacy Policy →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <Icon path={ICONS.sparkle} className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-white">AILAS</span>
          <span className="text-slate-500 text-sm">— AI-Assisted Learning Analytics System</span>
        </div>
        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} Dalubhasaang Politekniko ng Lungsod ng Baliwag (BTECH). All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ── main export ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(ROLE_REDIRECTS[user.role] || "/login", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-gray-900">
      <NavBar />
      <Hero />
      <Features />
      <Stats />
      <HowItWorks />
      <RolesSection />
      <CTA />
      <Footer />
    </div>
  );
}
