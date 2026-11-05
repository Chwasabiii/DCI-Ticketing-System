import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircleQuestion } from "lucide-react";
import { FaqList } from "@/components/help/faq-list";
import { FaqAssistant } from "@/components/help/faq-assistant";
import { createClient } from "@/lib/supabase/server";
import type { FaqEntry } from "@/lib/types";

export default async function FaqsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faq_entries")
    .select("id, question, answer, display_order, is_published, updated_at")
    .eq("is_published", true)
    .order("display_order")
    .order("id")
    .returns<FaqEntry[]>();

  if (error) throw new Error(`Could not load FAQs: ${error.message}`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#172b4d] via-[#203e6d] to-[#315795] px-6 py-7 text-white shadow-[0_14px_36px_rgba(18,33,58,0.15)] sm:px-9 sm:py-9">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-100">
          <BookOpen className="h-4 w-4" /> Help center
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">How can we help?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90 sm:text-base">
          Search quick answers about submitting requests and getting support.
        </p>
      </header>

      <FaqAssistant />
      <FaqList entries={data} />

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-sm">
            <MessageCircleQuestion className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-navy">Still need a hand?</h2>
            <p className="mt-1 text-sm text-slate-600">Open a ticket and the support team will take it from there.</p>
          </div>
        </div>
        <Link href="/tickets/new" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:bg-blue-700">
          Open a ticket <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
