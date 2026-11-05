"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteFaq, saveFaq } from "@/lib/actions";
import type { FaqEntry } from "@/lib/types";

export function FaqManagement({ entries }: { entries: FaqEntry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
