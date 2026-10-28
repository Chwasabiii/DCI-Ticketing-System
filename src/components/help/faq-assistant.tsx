"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BookOpen, LoaderCircle, Search } from "lucide-react";

type Reply = { answer: string; sources: { id: number; question: string }[] };

export function FaqAssistant() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !question.trim()) return;
    setBusy(true);
    setError("");
    setReply(null);
    try {
      const response = await fetch("/api/faq-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not answer. Please try again.");
      setReply(result as Reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="faq-assistant-title">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><BookOpen className="h-5 w-5" /></span>
        <div>
          <h2 id="faq-assistant-title" className="font-bold text-navy">Find an FAQ answer</h2>
          <p className="text-sm text-slate-600">Search published support answers and see the original FAQ.</p>
        </div>
      </div>
      <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="faq-assistant-question">Your question</label>
        <input
          id="faq-assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          placeholder="Search with a question about getting support..."
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 text-sm focus-ring"
        />
        <button disabled={busy || !question.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {busy ? "Searching..." : "Search"}
        </button>
      </form>
      {reply && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4" aria-live="polite">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{reply.answer}</p>
          {reply.sources.length > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">Published FAQ: {reply.sources.map((source) => source.question).join(" · ")}</p>}
          {reply.sources.length === 0 && <Link href="/tickets/new" className="mt-3 inline-block text-sm font-bold text-accent hover:underline">Open a support ticket</Link>}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">This search returns published FAQ answers as written. For anything not covered, open a support ticket.</p>
    </section>
  );
}
