interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;

  const items: (number | "…")[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) items.push(i);
  } else {
    items.push(1);
    if (page > 3) items.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) items.push(i);
    if (page < pages - 2) items.push("…");
    items.push(pages);
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
      >
        ‹
      </button>
      {items.map((item, i) =>
        item === "…" ? (
          <span key={`e-${i}`} className="px-2">…</span>
        ) : (
          <button
            key={item}
            onClick={() => onChange(item as number)}
            className={`px-3 py-1 rounded border transition-colors ${
              item === page
                ? "bg-brand-600 text-white border-brand-600"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === pages}
        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
      >
        ›
      </button>
      <span className="text-gray-500 ml-2">{total} total</span>
    </div>
  );
}
