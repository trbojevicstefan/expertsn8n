"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

export interface Facet {
  key: string;
  label: string;
  options: { value: string; count: number }[];
}

/**
 * Filters are derived from the profiles actually in the directory, so an option
 * never offers a filter that returns nothing. Selections live in the URL, which
 * keeps a filtered directory shareable and the page a server render.
 */
export function ExpertFilters({ facets, sort }: { facets: Facet[]; sort: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const selected = (key: string) => (params.get(key) || "").split(",").filter(Boolean);

  const push = (next: URLSearchParams) => {
    const qs = next.toString();
    router.push(qs ? `/experts?${qs}` : "/experts");
  };

  const toggle = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const current = selected(key);
    const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (updated.length) next.set(key, updated.join(","));
    else next.delete(key);
    push(next);
  };

  const setSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "recommended") next.set("sort", value);
    else next.delete("sort");
    push(next);
  };

  const activeCount = facets.reduce((n, f) => n + selected(f.key).length, 0)
    + (params.get("verified") ? 1 : 0);

  return (
    <>
      <div className="filter-block">
        <h4>Sort</h4>
        <select
          className="select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort experts"
        >
          <option value="recommended">Recommended</option>
          <option value="rate-asc">Lowest rate</option>
          <option value="rate-desc">Highest rate</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="filter-block">
        <h4>Review status</h4>
        <label className="check">
          <input
            type="checkbox"
            checked={params.get("verified") === "1"}
            onChange={(e) => {
              const next = new URLSearchParams(params.toString());
              if (e.target.checked) next.set("verified", "1");
              else next.delete("verified");
              push(next);
            }}
          />
          Vetted profiles only
        </label>
      </div>

      {facets.map((f) => (
        <div className="filter-block" key={f.key}>
          <h4>{f.label}</h4>
          {f.options.map((o) => (
            <label className="check" key={o.value}>
              <input
                type="checkbox"
                checked={selected(f.key).includes(o.value)}
                onChange={() => toggle(f.key, o.value)}
              />
              {o.value}
              <span className="facet-count">{o.count}</span>
            </label>
          ))}
        </div>
      ))}

      {activeCount > 0 && (
        <button type="button" className="filter-clear" onClick={() => router.push("/experts")}>
          <X size={13} strokeWidth={2.4} /> Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
        </button>
      )}
    </>
  );
}
