export default function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, page]);
    if (page > 1) set.add(page - 1);
    if (page < totalPages) set.add(page + 1);
    return [...set].sort((a, b) => a - b);
  };

  const pages = getPages();

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">{start}–{end} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {pages.map((p, i) => {
          const gap = pages[i - 1] && p - pages[i - 1] > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {gap && <span className="text-xs text-gray-300 px-0.5">…</span>}
              <button
                onClick={() => onChange(p)}
                className={`min-w-[28px] h-7 text-xs rounded-lg font-medium transition-colors ${
                  p === page ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button
          aria-label="Next page"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
