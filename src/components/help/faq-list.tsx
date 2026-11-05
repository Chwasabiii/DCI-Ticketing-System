"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { FaqEntry } from "@/lib/types";

export function FaqList({ entries }: { entries: FaqEntry[] }) {
  const [query, setQuery] = useState("");
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter((entry) =>
      `${entry.question} ${entry.answer}`.toLowerCase().includes(normalizedQuery)
    );
  }, [entries, query]);

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Search FAQs</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for an answer..."
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm focus-ring"
        />
      </label>

      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-navy">
            {entries.length === 0 ? "No FAQs have been published yet" : "No answers match that search"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {entries.length === 0
              ? "Please contact your support team for help."
              : "Try a different keyword or browse all questions."}
          </p>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 text-sm font-semibold text-accent hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
          {filteredEntries.map((entry) => (
            <details key={entry.id} className="group p-5 sm:p-6">
              <summary className="cursor-pointer list-none text-base font-semibold text-navy marker:hidden focus-ring">
                <span className="flex items-center justify-between gap-4">
                  {entry.question}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-lg font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {entry.answer}
              </p>
            </details>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-slate-500">
        {filteredEntries.length} {filteredEntries.length === 1 ? "answer" : "answers"}
      </p>
    </div>
  );
}
