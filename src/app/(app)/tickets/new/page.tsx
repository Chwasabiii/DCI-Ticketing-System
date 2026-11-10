import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calculator, CheckCircle2, CircleHelp, TicketPlus } from "lucide-react";
import { TicketForm } from "@/components/tickets/ticket-form";
import { getCurrentContext } from "@/lib/data";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ team?: string; draft?: string }> }) {
  const { profile } = await getCurrentContext();
  if (!profile) redirect("/login");
  if (profile.user_side !== "client") redirect("/dashboard");

  const { team, draft } = await searchParams;
  const teamSlug = team === "cost-control" || team === "it-support" ? team : null;
  if (!teamSlug) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-[#172b4d] to-[#294c81] px-6 py-6 text-white shadow-[0_14px_36px_rgba(18,33,58,0.15)] sm:px-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-100">
            <TicketPlus className="h-4 w-4" />
            PMSG Support
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Choose a service team</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90 sm:text-base">
            Select the team that should receive your request. CCG requests go directly to the Cost Control Group.
          </p>
        </header>
        <section aria-label="Choose a service team" className="grid gap-4 md:grid-cols-2">
          <Link href="/tickets/new?team=it-support" className="group rounded-2xl border border-blue-100 bg-white p-6 shadow-soft transition hover:border-blue-300 hover:shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-accent"><TicketPlus className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold text-navy">IT Support Department</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Get help with accounts, devices, software, access, or technical incidents.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent">Create an IT request <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/tickets/new?team=cost-control" className="group rounded-2xl border border-emerald-100 bg-white p-6 shadow-soft transition hover:border-emerald-300 hover:shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Calculator className="h-5 w-5" /></span>
            <h2 className="mt-4 text-lg font-bold text-navy">Cost Control Group</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Request unit rates, vendor lists, or TOR and contract references from CCG.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">Create a CCG request <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </section>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#172b4d] to-[#294c81] px-6 py-6 text-white shadow-[0_14px_36px_rgba(18,33,58,0.15)] sm:px-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-100">
          <TicketPlus className="h-4 w-4" />
          PMSG Support
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{teamSlug === "cost-control" ? "CCG request" : "IT Support request"}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90 sm:text-base">
          {teamSlug === "cost-control"
            ? "Choose a CCG service and include the project, material, and document details needed to respond. CCG will acknowledge and review your request."
            : "Tell us what you need. Our support team will review your request and keep you updated."}
        </p>
      </header>
      {teamSlug === "cost-control" && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">CCG support does not cover PMG requests that include Procurement in their scope. Vendor quote timing is 3–6 weeks; CCG cannot guarantee a vendor will respond or suit the work’s scope and complexity.</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <TicketForm key={`${teamSlug}-${draft ?? ""}`} teamSlug={teamSlug} />
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
                  Include dates, system details, and document references.
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
