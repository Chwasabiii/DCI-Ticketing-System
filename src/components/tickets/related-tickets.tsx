"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkRelatedTicket, unlinkRelatedTicket } from "@/lib/actions";
import type { RelatedTicket } from "@/lib/types";

export function RelatedTickets({
  ticketId,
  tickets,
  canManage
}: {
  ticketId: string;
  tickets: RelatedTicket[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await linkRelatedTicket(form);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      formElement.reset();
      setNotice(result.success ?? "Related ticket linked.");
      router.refresh();
    } catch {
      setError("The tickets could not be linked. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink(relatedId: string | number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.set("ticket_id", ticketId);
    form.set("related_ticket_id", String(relatedId));
    try {
      const result = await unlinkRelatedTicket(form);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNotice(result.success ?? "Ticket link removed.");
      router.refresh();
    } catch {
      setError("The ticket link could not be removed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-6">
      <div className="flex items-center gap-2">
        <Link2 aria-hidden="true" className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-navy">Related tickets</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">Connect tickets that describe the same issue or depend on one another.</p>

      {tickets.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <Link href={`/tickets/${ticket.id}`} className="min-w-0 rounded focus-ring">
                <span className="block text-xs font-bold text-accent">{ticket.ticket_no ?? `Ticket #${ticket.id}`}</span>
                <span className="mt-0.5 block break-words text-sm font-semibold text-slate-800">{ticket.title}</span>
                <span className="mt-1 block text-xs capitalize text-slate-500">
                  {String(ticket.status).replaceAll("_", " ")}
                  {ticket.project?.name ? ` · ${ticket.project.name}` : ""}
                </span>
              </Link>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleUnlink(ticket.id)}
                  aria-label={`Unlink ${ticket.ticket_no ?? `ticket ${ticket.id}`}`}
                  className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-urgent disabled:opacity-50"
                >
                  <Unlink aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No related tickets have been linked.</p>
      )}

      {canManage && (
        <form onSubmit={handleLink} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <label className="sr-only" htmlFor={`related-ticket-${ticketId}`}>Ticket number to link</label>
          <input
            id={`related-ticket-${ticketId}`}
            name="related_ticket_no"
            required
            maxLength={40}
            placeholder="Ticket number, e.g. DCI-2026-0012"
            disabled={busy}
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus-ring"
          />
          <Button type="submit" loading={busy}>
            <Link2 aria-hidden="true" className="h-4 w-4" />
            {busy ? "Saving…" : "Link ticket"}
          </Button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-resolved">{notice}</p>}
    </section>
  );
}
