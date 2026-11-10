"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileEdit, Trash2 } from "lucide-react";
import { deleteTicketDraft, readTicketDrafts, type TicketDraft } from "@/lib/ticket-drafts";
import { formatDateTime } from "@/lib/utils";

export function TicketDraftsList() {
  const [drafts, setDrafts] = useState<TicketDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refreshDrafts = () => setDrafts(readTicketDrafts());
    refreshDrafts();
    window.addEventListener("storage", refreshDrafts);
    return () => window.removeEventListener("storage", refreshDrafts);
  }, []);
  return <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
    <div><h2 className="font-bold text-navy">Your saved drafts</h2><p className="mt-1 text-sm text-slate-600">Drafts saved on this device appear here.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {drafts.length ? <ul className="grid gap-2 sm:grid-cols-2">
      {drafts.map((draft) => <li key={draft.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white p-3">
        <Link href={`/tickets/new?team=${encodeURIComponent(draft.teamSlug)}&draft=${encodeURIComponent(draft.id)}`} className="flex min-w-0 items-center gap-3 hover:text-accent">
          <FileEdit className="h-5 w-5 shrink-0 text-amber-700" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{draft.title.trim() || "Untitled ticket"}</span><span className="text-xs text-slate-500">Draft · {formatDateTime(draft.updatedAt)}</span></span>
        </Link>
        <button type="button" aria-label="Delete draft" onClick={() => {
          if (!deleteTicketDraft(draft.id)) {
            setError("Could not delete the draft from this device. Please try again.");
            return;
          }
          setError(null);
          setDrafts(readTicketDrafts());
        }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
      </li>)}
    </ul> : <p className="rounded-xl border border-amber-100 bg-white px-4 py-3 text-sm text-slate-600">No drafts saved yet. Open a ticket and select <strong>Save draft</strong>; drafts are also saved automatically as you type.</p>}
  </section>;
}
