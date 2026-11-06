"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BookOpen, LoaderCircle, Sparkles } from "lucide-react";
import { createFaqDraftFromTicket, deleteFaq, saveFaq } from "@/lib/actions";
import type { FaqEntry } from "@/lib/types";

type ResolvedTicket = {
  id: number;
  ticket_no: string | null;
  title: string;
  resolution_notes: string;
  resolved_at: string | null;
};

export function FaqManagement({ entries, resolvedTickets }: { entries: FaqEntry[]; resolvedTickets: ResolvedTicket[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftingTicketId, setDraftingTicketId] = useState<number | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (busyId !== null) return;

    const form = event.currentTarget;
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const result = await saveFaq(new FormData(form));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "FAQ saved.");
      if (!id) form.reset();
      router.refresh();
    } catch {
      setError("The FAQ could not be saved. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (busyId !== null) return;

    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("faq_id", id);
      const result = await deleteFaq(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "FAQ deleted.");
      router.refresh();
    } catch {
      setError("The FAQ could not be deleted. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateDraft(ticketId: number) {
    if (busyId !== null || draftingTicketId !== null) return;
    setDraftingTicketId(ticketId);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("ticket_id", String(ticketId));
      const result = await createFaqDraftFromTicket(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "FAQ draft created. Review it before publishing.");
      router.refresh();
    } catch {
      setError("The FAQ draft could not be created. Please try again.");
    } finally {
      setDraftingTicketId(null);
    }
  }

  return (
    <div className="space-y-5">
      {(error || message) && (
        <p
          role={error ? "alert" : "status"}
          className={`text-sm ${error ? "text-red-700" : "text-resolved"}`}
        >
          {error ?? message}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-lg font-bold text-navy">Add a FAQ</h2>
        <p className="mt-1 text-sm text-slate-600">
          Published answers appear in the FAQ section for signed-in users.
        </p>
        <form onSubmit={(event) => handleSave(event, "")} className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Question
            <input
              name="question"
              required
              maxLength={300}
              disabled={busyId !== null}
              className="min-h-10 rounded-md border border-slate-200 px-3 font-normal focus-ring"
              placeholder="How do I submit a support request?"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Answer
            <textarea
              name="answer"
              required
              maxLength={5000}
              rows={4}
              disabled={busyId !== null}
              className="rounded-md border border-slate-200 px-3 py-2 font-normal focus-ring"
              placeholder="Explain the steps clearly."
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="is_published" defaultChecked disabled={busyId !== null} />
                Publish
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                Order
                <input
                  type="number"
                  name="display_order"
                  min={0}
                  max={10000}
                  defaultValue={0}
                  disabled={busyId !== null}
                  className="min-h-9 w-20 rounded-md border border-slate-200 px-2 focus-ring"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busyId !== null}
              className="focus-ring min-h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:opacity-60"
            >
              {busyId === "" ? "Adding..." : "Add FAQ"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-soft">
        <div className="flex items-start gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 sm:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-sm ring-1 ring-blue-100"><Sparkles className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-bold text-navy">Turn resolved tickets into FAQ articles</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">Create an unpublished draft from a completed solution. Review the wording and publish it when it is ready.</p>
          </div>
        </div>
        {resolvedTickets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 sm:px-6">No eligible resolved tickets are waiting for an FAQ draft.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {resolvedTickets.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-accent">{ticket.ticket_no ?? `Ticket #${ticket.id}`}</p>
                  <h3 className="mt-1 truncate text-sm font-semibold text-navy">{ticket.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{ticket.resolution_notes}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateDraft(ticket.id)}
                  disabled={busyId !== null || draftingTicketId !== null}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white transition hover:bg-[#163b68] disabled:opacity-60"
                >
                  {draftingTicketId === ticket.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                  {draftingTicketId === ticket.id ? "Creating draft…" : "Create FAQ draft"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-navy">Manage FAQs</h2>
          <p className="mt-1 text-sm text-slate-600">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · Unpublished answers are hidden from readers.
          </p>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No FAQs yet. Add the first one above.
          </div>
        ) : (
          entries.map((entry) => (
            <form
              key={entry.id}
              onSubmit={(event) => handleSave(event, String(entry.id))}
              className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <input type="hidden" name="faq_id" value={entry.id} />
              {entry.source_ticket_id && (
                <p className="text-xs text-slate-500">
                  Drafted from ticket #{entry.source_ticket_id}. <a href={`/tickets/${entry.source_ticket_id}`} className="font-semibold text-accent hover:underline">View source ticket</a>
                </p>
              )}
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Question
                <input
                  name="question"
                  required
                  maxLength={300}
                  defaultValue={entry.question}
                  disabled={busyId !== null}
                  className="min-h-10 rounded-md border border-slate-200 px-3 font-normal focus-ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Answer
                <textarea
                  name="answer"
                  required
                  maxLength={5000}
                  rows={4}
                  defaultValue={entry.answer}
                  disabled={busyId !== null}
                  className="rounded-md border border-slate-200 px-3 py-2 font-normal focus-ring"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="is_published"
                      defaultChecked={entry.is_published}
                      disabled={busyId !== null}
                    />
                    Published
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    Order
                    <input
                      type="number"
                      name="display_order"
                      min={0}
                      max={10000}
                      defaultValue={entry.display_order}
                      disabled={busyId !== null}
                      className="min-h-9 w-20 rounded-md border border-slate-200 px-2 focus-ring"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(String(entry.id))}
                    disabled={busyId !== null}
                    className="focus-ring min-h-9 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {busyId === String(entry.id) ? "Saving..." : "Delete"}
                  </button>
                  <button
                    type="submit"
                    disabled={busyId !== null}
                    className="focus-ring min-h-9 rounded-md bg-navy px-3 text-sm font-semibold text-white hover:bg-[#163b68] disabled:opacity-60"
                  >
                    {busyId === String(entry.id) ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </form>
          ))
        )}
      </section>
    </div>
  );
}
