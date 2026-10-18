"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Row = Record<string, string | number | null | undefined>;

export function SimpleTable({
  title,
  rows,
  columns
}: {
  title: string;
  rows: Row[];
  columns: string[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0] ?? "");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredRows = useMemo(() => rows.filter((row) =>
    columns.some((column) => String(row[column] ?? "").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  ).sort((a, b) => {
    const left = String(a[sortKey] ?? "");
    const right = String(b[sortKey] ?? "");
    return (ascending ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  }), [rows, columns, query, sortKey, ascending]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(column: string) {
    if (sortKey === column) setAscending((current) => !current);
    else { setSortKey(column); setAscending(true); }
    setPage(1);
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-lg font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-500">{filteredRows.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} of ${filteredRows.length}` : "0"} records</p></div>
        <label className="w-full sm:max-w-xs"><span className="sr-only">Search {title}</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Search ${title.toLocaleLowerCase()}...`} className="min-h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus-ring" /></span></label>
      </div>
      <div className="divide-y divide-slate-100 sm:hidden">
        {pageRows.map((row, index) => <article key={String(row.id ?? index)} className="p-4">
          <p className="font-semibold text-navy">{String(row[columns[0]] ?? "Not set")}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">{columns.slice(1).map((column) => <div key={column} className="min-w-0"><dt className="capitalize text-slate-400">{column.replaceAll("_", " ")}</dt><dd className="mt-0.5 truncate text-slate-700">{column === "status" || column === "user_side" ? <Badge value={String(row[column] ?? "unset")} /> : String(row[column] ?? "Not set")}</dd></div>)}</dl>
        </article>)}
        {pageRows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">{rows.length ? "No records match your search." : "No records found."}</p>}
      </div>
      <div role="region" tabIndex={0} className="hidden overscroll-x-contain overflow-x-auto sm:block" aria-label={`${title} records; swipe horizontally to see all columns`}>
        <table className="min-w-[620px] divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} aria-sort={sortKey === column ? (ascending ? "ascending" : "descending") : "none"} className="px-4 py-3">
                  <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1.5 rounded-sm capitalize hover:text-navy focus-ring">{column.replaceAll("_", " ")}{sortKey === column ? ascending ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={columns.length}>
                  {rows.length ? "No records match your search." : "No records found."}
                </td>
              </tr>
            )}
            {pageRows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <td key={column} className="px-4 py-4 text-slate-700">
                    {column === "status" || column === "user_side" ? (
                      <Badge value={String(row[column] ?? "unset")} />
                    ) : (
                      String(row[column] ?? "Not set")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
        <span className="text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
        <div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next</button></div>
      </div>
    </div>
  );
}
