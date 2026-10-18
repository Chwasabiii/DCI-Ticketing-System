import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleHelp, LockKeyhole, TicketPlus } from "lucide-react";
import { TicketForm } from "@/components/tickets/ticket-form";

export default function NewTicketPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#172b4d] to-[#294c81] px-6 py-6 text-white shadow-[0_14px_36px_rgba(18,33,58,0.15)] sm:px-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-100">
          <TicketPlus className="h-4 w-4" />
          PMSG Support
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Open a ticket</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90 sm:text-base">
          Tell us what you need. Our support team will review your request and keep you updated.
        </p>
      </header>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <TicketForm />
        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
            <h2 className="font-bold text-navy">A few tips</h2>
            <ul className="mt-4 space-y-4">
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-resolved" />
                <span className="text-sm leading-5 text-slate-600">
                  Use a short title and describe the outcome you need.
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-resolved" />
                <span className="text-sm leading-5 text-slate-600">
                  Include dates, project details, and document references.
                </span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-resolved" />
                <span className="text-sm leading-5 text-slate-600">
                  Add screenshots or files that will help us understand the request.
                </span>
              </li>
            </ul>
          </section>
          <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
            <div className="flex items-center gap-2 font-bold text-violet-950">
              <LockKeyhole className="h-4 w-4" />
              Need privacy?
            </div>
            <p className="mt-2 text-sm leading-5 text-violet-900/80">
              Mark your ticket confidential to limit who can view its details and files.
            </p>
          </section>
          <Link
            href="/faqs"
            className="group flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 transition-colors hover:bg-blue-50"
          >
            <span className="flex items-center gap-3">
              <CircleHelp className="h-5 w-5 text-accent" />
              <span>
                <span className="block text-sm font-bold text-navy">Need more help?</span>
                <span className="mt-0.5 block text-xs text-slate-600">Browse common questions</span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
