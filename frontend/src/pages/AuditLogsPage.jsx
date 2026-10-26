import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import api from "../services/api";

// ─── Shared constants ─────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  login:                { label: "Login",            bg: "bg-green-50",   text: "text-green-700",   severity: "info" },
  logout:               { label: "Logout",           bg: "bg-gray-100",   text: "text-gray-500",    severity: "info" },
  upload_csv:           { label: "CSV Upload",       bg: "bg-blue-50",    text: "text-blue-700",    severity: "info" },
  upload_syllabus:      { label: "Syllabus Upload",  bg: "bg-blue-50",    text: "text-blue-700",    severity: "info" },
  validate_syllabus:    { label: "Validated",        bg: "bg-indigo-50",  text: "text-indigo-700",  severity: "info" },
  override_tag:         { label: "Tag Override",     bg: "bg-amber-50",   text: "text-amber-700",   severity: "warning" },
  bulk_import_students: { label: "Student Import",   bg: "bg-cyan-50",    text: "text-cyan-700",    severity: "info" },
  add_resource:         { label: "Resource Added",   bg: "bg-emerald-50", text: "text-emerald-700", severity: "info" },
  delete_resource:      { label: "Resource Deleted", bg: "bg-red-50",     text: "text-red-700",     severity: "danger" },
  change_password:      { label: "Password Changed", bg: "bg-purple-50",  text: "text-purple-700",  severity: "danger" },
};

const ACTION_LABELS = Object.fromEntries(
  Object.entries(ACTION_CONFIG).map(([k, v]) => [k, v.label])
);

const TARGET_LABELS = {
  users: "Users", syllabus_uploads: "Syllabus", assessments: "Assessments",
  resources: "Resources", courses: "Courses", competencies: "Competencies",
  assessment_items: "Assessment Items", recommendations: "Recommendations",
};

const PAGE_SIZE   = 10;
const FETCH_LIMIT = 1000;

const SEVERITY = {
  delete_resource: "danger", change_password: "danger", override_tag: "warning",
};

// ─── UI Sub-components ────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50 animate-pulse">
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-24" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-200 rounded-full shrink-0" />
          <div className="h-4 bg-gray-200 rounded w-28" />
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-100 rounded w-20" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-2 bg-gray-100 rounded-full w-2" /></td>
      <td className="px-4 py-3">
        <div className="h-3 bg-gray-100 rounded w-24" />
        <div className="h-3 bg-gray-100 rounded w-16 mt-1" />
      </td>
    </tr>
  );
}

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action] ?? { label: action ?? "Unknown", bg: "bg-gray-100", text: "text-gray-500" };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ActorBadge({ name }) {
  const initial = name ? name[0].toUpperCase() : "?";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
        {initial}
      </span>
      <span className="font-medium text-gray-800 text-sm">{name || "—"}</span>
    </span>
  );
}

function EmptyState({ hasFilters, onClear }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 py-16 text-center">
      <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {hasFilters ? (
        <>
          <p className="text-gray-500 text-sm font-medium">No logs match your filters.</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">Try adjusting the date range, action type, or search term.</p>
          <button onClick={onClear}
            className="border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors">
            Clear filters
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-500 text-sm font-medium">No audit logs yet.</p>
          <p className="text-gray-400 text-xs mt-1">System activity will appear here as users interact with AILAS.</p>
        </>
      )}
    </div>
  );
}

function FreshnessIndicator({ fetchedAt }) {
  if (!fetchedAt) return null;
  const minutesAgo = Math.floor((Date.now() - fetchedAt) / 60000);
  return (
    <span className="text-xs text-gray-400 mt-0.5 block">
      {minutesAgo < 1 ? "Updated just now" : `Updated ${minutesAgo} min ago`}
    </span>
  );
}

function CountBadge({ count, loading }) {
  if (loading) return <span className="animate-pulse bg-gray-200 rounded-full w-20 h-5 inline-block" />;
  return (
    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
      {count} record{count !== 1 ? "s" : ""}
    </span>
  );
}

function TruncationWarning({ shown }) {
  if (shown < FETCH_LIMIT) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      Showing the {shown} most recent records. Older logs may not be visible — use date range filters to narrow your search.
    </div>
  );
}

// ─── Filter Components ────────────────────────────────────────────────────────

function ActionFilterPills({ selected, onChange, counts }) {
  const allActive = selected.size === 0;

  const handlePillClick = (action) => {
    const next = new Set(selected);
    next.has(action) ? next.delete(action) : next.add(action);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <button onClick={() => onChange(new Set())}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
          allActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
        }`}>
        All
      </button>
      {Object.keys(ACTION_LABELS).map(action => {
        const isActive = selected.has(action);
        const count = counts?.[action] ?? 0;
        return (
          <button key={action} onClick={() => handlePillClick(action)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              isActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
            }`}>
            {ACTION_LABELS[action]}
            {count > 0 && (
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DateRangeFilter({ from, to, onChange }) {
  const today  = new Date().toISOString().split("T")[0];
  const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString().split("T")[0];

  const inputCls  = "border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const presetCls = "text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 shrink-0">Date:</span>
      <input aria-label="From date" type="date" value={from} max={to || today}
        onChange={e => onChange({ from: e.target.value, to })} className={inputCls} />
      <span className="text-xs text-gray-400">to</span>
      <input aria-label="To date" type="date" value={to} min={from || undefined} max={today}
        onChange={e => onChange({ from, to: e.target.value })} className={inputCls} />
      <div className="flex gap-1.5">
        <button onClick={() => onChange({ from: today, to: today })} className={presetCls}>Today</button>
        <button onClick={() => onChange({ from: daysAgo(7), to: today })} className={presetCls}>7 days</button>
        <button onClick={() => onChange({ from: daysAgo(30), to: today })} className={presetCls}>30 days</button>
        {(from || to) && (
          <button onClick={() => onChange({ from: "", to: "" })}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Clear</button>
        )}
      </div>
    </div>
  );
}

function ExportButton({ logs }) {
  const [exporting, setExporting] = useState(false);
  const isEmpty = !logs || logs.length === 0;

  const handleExport = () => {
    if (isEmpty) return;
    setExporting(true);
    try {
      const escape = v => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = "Timestamp,Action,Actor,Target,Details";
      const rows = logs.map(log => [
        escape(log.timestamp ? new Date(log.timestamp).toISOString() : ""),
        escape(ACTION_LABELS[log.action] || log.action || ""),
        escape(log.actor_name || ""),
        escape(TARGET_LABELS[log.target_table] || log.target_table || ""),
        escape(log.extra_data ? JSON.stringify(log.extra_data) : ""),
      ].join(","));
      const csv  = [header, ...rows].join("\n");
      const date = new Date().toISOString().split("T")[0];
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
        download: `audit-logs-${date}.csv`,
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally { setExporting(false); }
  };

  return (
    <button onClick={handleExport} disabled={isEmpty || exporting}
      className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {exporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}

function ExpandedDetailPanel({ log, onClose }) {
  if (!log) return null;

  const ts = log.timestamp;
  const formattedTimestamp = ts
    ? new Date(ts).toLocaleString("en-PH", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: true, timeZone: "Asia/Manila",
      }) + " (PHT)"
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-base font-semibold text-gray-800">Log Detail</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <ActionBadge action={log.action} />
            <span className="text-xs text-gray-500">{formattedTimestamp}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">Actor</span>
            <span className="text-sm text-gray-800">{log.actor_name || "—"}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">Target</span>
            <span className="text-sm text-gray-800">{TARGET_LABELS[log.target_table] || log.target_table || "—"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400">Details</span>
            {log.extra_data ? (
              <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(log.extra_data, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-gray-400">No additional details recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState("");
  const [fetchedAt, setFetchedAt]     = useState(null);

  const [search, setSearch]                   = useState("");
  const [selectedActions, setSelectedActions] = useState(new Set());
  const [actorFilter, setActorFilter]         = useState("");
  const [dateFrom, setDateFrom]               = useState("");
  const [dateTo, setDateTo]                   = useState("");
  const [sortDir, setSortDir]                 = useState("desc");

  const [page, setPage]               = useState(1);
  const [expandedLog, setExpandedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true); setFetchError("");
    try {
      const res = await api.get(`/analytics/admin/audit-logs?limit=${FETCH_LIMIT}`);
      setLogs(res.data || []);
      setFetchedAt(new Date());
    } catch (err) {
      setFetchError(err.response?.data?.detail || "Failed to load audit logs.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionCounts = logs.reduce((acc, log) => {
    if (log.action) acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {});

  const filtered = logs.filter(log => {
    if (selectedActions.size > 0 && !selectedActions.has(log.action)) return false;
    if (actorFilter && (log.actor_name || "") !== actorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const label  = (ACTION_LABELS[log.action] || log.action || "").toLowerCase();
      const actor  = (log.actor_name || "").toLowerCase();
      const target = (TARGET_LABELS[log.target_table] || log.target_table || "").toLowerCase();
      if (!actor.includes(q) && !label.includes(q) && !target.includes(q)) return false;
    }
    if (dateFrom || dateTo) {
      const logDate = log.timestamp ? log.timestamp.split("T")[0] : "";
      if (dateFrom && logDate < dateFrom) return false;
      if (dateTo   && logDate > dateTo)   return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return sortDir === "desc" ? tb - ta : ta - tb;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = search || selectedActions.size > 0 || actorFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch(""); setSelectedActions(new Set()); setActorFilter("");
    setDateFrom(""); setDateTo(""); setPage(1);
  };

  const formatDate = ts => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila",
    });
  };
  const formatTime = ts => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Manila",
    }) + " PHT";
  };

  const severityBorder = action => {
    if (SEVERITY[action] === "danger")  return "border-l-4 border-l-red-400";
    if (SEVERITY[action] === "warning") return "border-l-4 border-l-amber-400";
    return "border-l-4 border-l-transparent";
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (page > 4) pages.push("...");
    const start = Math.max(2, page - 2);
    const end   = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 3) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const theadRow = (
    <tr className="border-b border-gray-100 bg-gray-50">
      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Target</th>
      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Details</th>
      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
    </tr>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">

        {expandedLog && <ExpandedDetailPanel log={expandedLog} onClose={() => setExpandedLog(null)} />}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Audit Logs</h1>
            <p className="text-sm text-gray-500 mt-0.5">Security events and system activity</p>
            <FreshnessIndicator fetchedAt={fetchedAt} />
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <CountBadge count={filtered.length} loading={loading} />
            <ExportButton logs={sorted} />
            <button onClick={fetchLogs} disabled={loading}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50">
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {logs.length >= FETCH_LIMIT && <TruncationWarning shown={logs.length} />}

        {fetchError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{fetchError}</div>
        )}

        {/* Actor filter chip */}
        {actorFilter && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Filtered by actor:</span>
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {actorFilter}
              <button onClick={() => { setActorFilter(""); setPage(1); }}
                className="text-indigo-400 hover:text-indigo-600 transition-colors leading-none">&times;</button>
            </span>
          </div>
        )}

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search by actor, action, or target…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors" />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none">&times;</button>
            )}
          </div>
          <button onClick={() => { setSortDir(d => d === "desc" ? "asc" : "desc"); setPage(1); }}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {/* Date range */}
        <DateRangeFilter from={dateFrom} to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); setPage(1); }} />

        {/* Action filter pills */}
        <ActionFilterPills selected={selectedActions}
          onChange={s => { setSelectedActions(s); setPage(1); }}
          counts={actionCounts} />

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>{theadRow}</thead>
              <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <table className="w-full text-sm">
              <thead>{theadRow}</thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(log => (
                  <tr key={log.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${severityBorder(log.action)}`}
                    onClick={() => setExpandedLog(log)}>
                    <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); setActorFilter(log.actor_name || ""); setPage(1); }}
                        className="hover:underline text-left">
                        <ActorBadge name={log.actor_name} />
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {TARGET_LABELS[log.target_table] || log.target_table || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
                      {log.extra_data ? (
                        <span className="text-xs text-gray-500 truncate block">
                          {Object.entries(log.extra_data).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs text-gray-600">{formatDate(log.timestamp)}</div>
                      <div className="text-xs text-gray-400">{formatTime(log.timestamp)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            {getPageNumbers().map((num, idx) =>
              num === "..." ? (
                <span key={`e-${idx}`} className="px-2 py-2 text-sm text-gray-400 select-none">&hellip;</span>
              ) : (
                <button key={num} onClick={() => setPage(num)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    page === num ? "bg-indigo-600 text-white border border-indigo-600" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {num}
                </button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Next
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
