"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import {
  finishBulkUserImport,
  processBulkUserImportBatch,
  startBulkUserImport,
  validateBulkUserImport
} from "@/lib/bulk-user-import-actions";
import { toCsv, type BulkUserInputRow, type BulkUserPreviewRow, type BulkUserResultRow } from "@/lib/bulk-user-import";

const batchSize = 10;

function downloadCsv(fileName: string, rows: Array<Array<unknown>>) {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function asResult(row: BulkUserInputRow, status: BulkUserResultRow["status"], reason: string): BulkUserResultRow {
  return { ...row, status, reason };
}

function resultKey(row: BulkUserInputRow) {
  return `${row.rowNumber}:${row.email.toLocaleLowerCase()}`;
}

export function BulkUserImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BulkUserPreviewRow[]>([]);
  const [results, setResults] = useState<BulkUserResultRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  const readyCount = rows.filter((row) => row.status === "ready").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  const existsCount = rows.filter((row) => row.status === "already_exists").length;
  const invitedCount = results.filter((row) => row.status === "invited").length;
  const failedCount = results.filter((row) => row.status === "failed").length;
  const skippedCount = results.filter((row) => row.status === "skipped").length;
  const hasPreview = rows.length > 0;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setRows([]);
    setResults([]);
    setFinished(false);
    setProgress("");
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await validateBulkUserImport(formData);
      if ("error" in response) {
        setError(response.error ?? "The file could not be validated.");
        return;
      }
      setFileName(response.fileName);
      setRows(response.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be validated.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport(importRows: BulkUserInputRow[], retry: boolean) {
    if (busy || importRows.length === 0) return;
    setBusy(true);
    setError("");
    setFinished(false);
    let started: Awaited<ReturnType<typeof startBulkUserImport>>;
    try {
      started = await startBulkUserImport(retry ? `retry-${fileName}` : fileName, importRows.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The import could not be started.");
      setBusy(false);
      return;
    }
    if ("error" in started) {
      setError(started.error ?? "The import could not be started.");
      setBusy(false);
      return;
    }

    const nextResults = retry ? [...results] : [];
    for (let offset = 0; offset < importRows.length; offset += batchSize) {
      const batch = importRows.slice(offset, offset + batchSize);
      setProgress(`Creating ${Math.min(offset + batch.length, importRows.length)} of ${importRows.length}...`);
      try {
        const response = await processBulkUserImportBatch(started.runId, batch);
        if ("error" in response) {
          const message = response.error ?? "The server rejected this batch.";
          for (const row of batch) nextResults.push(asResult(row, "failed", message));
          for (const row of importRows.slice(offset + batch.length)) {
            nextResults.push(asResult(row, "failed", "Not processed because the server rejected an earlier batch."));
          }
          setError(message);
          break;
        }
        nextResults.push(...response.results);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The server could not process this batch.";
        for (const row of batch) nextResults.push(asResult(row, "failed", message));
        for (const row of importRows.slice(offset + batch.length)) {
          nextResults.push(asResult(row, "failed", "Not processed because the server could not process an earlier batch."));
        }
        setError(message);
        break;
      }
    }

    setProgress("Finishing import...");
    try {
      const finish = await finishBulkUserImport(started.runId);
      if ("error" in finish) {
        const message = finish.error ?? "The import audit could not be completed.";
        setError((current) => current ? `${current} ${message}` : message);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The import audit could not be completed.";
      setError((current) => current ? `${current} ${message}` : message);
    }
    setResults((current) => {
      const merged = retry ? [...current] : [];
      for (const result of nextResults) {
        const index = merged.findIndex((previous) => resultKey(previous) === resultKey(result));
        if (index >= 0) merged[index] = result;
        else merged.push(result);
      }
      return merged.sort((left, right) => left.rowNumber - right.rowNumber);
    });
    setFinished(true);
    setProgress("");
    setBusy(false);
    router.refresh();
  }

  function reset() {
    if (busy) return;
    setRows([]);
    setResults([]);
    setFileName("");
    setError("");
    setProgress("");
    setFinished(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadErrorRows() {
    const invalidRows = rows.filter((row) => row.status !== "ready");
    downloadCsv("bulk-user-import-errors.csv", [
      ["row", "email", "full_name", "role", "department", "provider_roles", "errors"],
      ...invalidRows.map((row) => [
        row.rowNumber,
        row.email,
        row.full_name,
        row.role,
        row.department,
        row.provider_roles,
        row.errors.join(" ")
      ])
    ]);
  }

  function downloadResults() {
    downloadCsv("bulk-user-import-results.csv", [
      ["email", "status", "reason"],
      ...results.map((row) => [row.email, row.status, row.reason])
    ]);
  }

  const failedRows = results.filter((row) => row.status === "failed");

  return (
    <div className="space-y-6">
      <nav aria-label="Import steps" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 pb-3 text-sm font-medium text-slate-700">
        <span aria-current={!hasPreview ? "step" : undefined}>1 Upload</span>
        <span aria-current={hasPreview && !finished ? "step" : undefined}>2 Review</span>
        <span aria-current={finished ? "step" : undefined}>3 Done</span>
      </nav>

      <section aria-labelledby="upload-users-title" className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="upload-users-title" className="text-base font-semibold text-slate-900">Upload a file</h2>
            <p className="mt-1 text-sm text-slate-600">Use an .xlsx or .csv file. Maximum 2 MB and 500 user rows.</p>
            <p className="mt-1 text-sm text-slate-600">Service providers need a department and provider role. Separate multiple provider roles with semicolons; leave both blank for other account types.</p>
          </div>
          <Link href="/admin/users/import/template" className="focus-ring inline-flex min-h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Download template
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-slate-300 p-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            aria-label="Choose an Excel or CSV file"
            disabled={busy}
            onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            className="sr-only"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="focus-ring min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {busy && !progress ? "Validating..." : "Choose file"}
          </button>
          <span className="text-sm text-slate-700">{fileName || "No file selected"}</span>
        </div>
      </section>

      {error && <FeedbackMessage type="error">{error}</FeedbackMessage>}

      {hasPreview && !finished && (
        <section aria-labelledby="review-users-title" className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="review-users-title" className="text-base font-semibold text-slate-900">Review users</h2>
              <p className="mt-1 text-sm text-slate-700">{readyCount} ready, {errorCount} with errors, {existsCount} already exist</p>
            </div>
            {(errorCount > 0 || existsCount > 0) && (
              <button type="button" onClick={downloadErrorRows} className="focus-ring min-h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Download error rows
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700">
                <tr>{["Row", "Email", "Name", "Role", "Department", "Status", "Details"].map((heading) => <th key={heading} scope="col" className="px-3 py-2.5">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.email}`} className="align-top">
                    <td className="px-3 py-2.5 tabular-nums">{row.rowNumber}</td>
                    <td className="px-3 py-2.5">{row.email || "—"}</td>
                    <td className="px-3 py-2.5">{row.full_name || "—"}</td>
                    <td className="px-3 py-2.5">{row.role || "—"}{row.provider_roles && <span className="block text-xs text-slate-600">{row.provider_roles}</span>}</td>
                    <td className="px-3 py-2.5">{row.department || "—"}</td>
                    <td className="px-3 py-2.5"><Badge value={row.status === "ready" ? "Ready" : row.status === "already_exists" ? "Already exists" : "Error"} /></td>
                    <td className="max-w-80 px-3 py-2.5 text-slate-700">{row.errors.join(" ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy || readyCount === 0} onClick={() => void runImport(rows, false)} className="focus-ring min-h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Creating users..." : `Create ${readyCount} users`}
            </button>
            <button type="button" disabled={busy} onClick={reset} className="focus-ring min-h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            {progress && <span role="status" aria-live="polite" className="text-sm text-slate-700">{progress}</span>}
          </div>
        </section>
      )}

      {finished && (
        <section aria-labelledby="import-results-title" className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="import-results-title" className="text-base font-semibold text-slate-900">Import results</h2>
              <p className="mt-1 text-sm text-slate-700">{invitedCount} created and invited, {failedCount} failed, {skippedCount} skipped</p>
            </div>
            <button type="button" onClick={downloadResults} className="focus-ring min-h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Download results
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[650px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700">
                <tr>{["Row", "Email", "Status", "Reason"].map((heading) => <th key={heading} scope="col" className="px-3 py-2.5">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((row) => (
                  <tr key={resultKey(row)}>
                    <td className="px-3 py-2.5 tabular-nums">{row.rowNumber}</td>
                    <td className="px-3 py-2.5">{row.email || "—"}</td>
                    <td className="px-3 py-2.5"><Badge value={row.status} /></td>
                    <td className="px-3 py-2.5 text-slate-700">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {failedRows.length > 0 && (
              <button type="button" disabled={busy} onClick={() => void runImport(failedRows, true)} className="focus-ring min-h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {busy ? "Retrying..." : "Retry failed"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={reset} className="focus-ring min-h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:opacity-50">
              Import another file
            </button>
            {progress && <span role="status" aria-live="polite" className="text-sm text-slate-700">{progress}</span>}
          </div>
        </section>
      )}
    </div>
  );
}
