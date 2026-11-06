import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calculator, Clock3, Plus, Ticket } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getCurrentContext, getServiceTeams, getTeamTickets } from "@/lib/data";

export default async function CostControlPage() {
  const [{ profile }, teams] = await Promise.all([
    getCurrentContext(),
    getServiceTeams({ inScopeOnly: true })
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side === "employee" && profile.service_team?.slug !== "cost-control") redirect("/dashboard");
  if (profile.user_side === "admin") redirect("/dashboard");

  const team = teams.find((item) => item.slug === "cost-control");
  if (!team) throw new Error("The Cost Control Group service team is not configured.");
  const tickets = await getTeamTickets(team.id);
  const isProvider = profile.user_side === "employee";
  const active = tickets.filter((ticket) => !["resolved", "closed", "rejected"].includes(ticket.status));
  const pending = tickets.filter((ticket) => ticket.status === "open");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#173d38] to-[#26745f] p-6 text-white shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10"><Calculator className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">Service team</p>
            <h1 className="mt-2 text-3xl font-bold">Cost Control Group</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">{isProvider ? "Review requests, check available references, and send CCG responses." : "Request unit rates, vendor lists, or TOR and contract references."}</p>
          </div>
        </div>
        {!isProvider && <Link href="/tickets/new?team=cost-control" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50"><Plus className="h-4 w-4" />New CCG request</Link>}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isProvider ? "Active CCG tickets" : "Your active requests"}</p><p className="mt-2 text-3xl font-bold text-navy">{active.length}</p><p className="mt-1 text-xs text-slate-500">In progress or awaiting action</p></article>
        <article className="rounded-2xl border border-amber-100 bg-white p-5 shadow-soft"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Needs acknowledgement</p><p className="mt-2 text-3xl font-bold text-navy">{pending.length}</p><p className="mt-1 text-xs text-slate-500">Newly submitted requests</p></article>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><Clock3 className="h-5 w-5" /></span><div><p className="font-bold text-navy">Response targets</p><p className="mt-1 text-xs leading-5 text-slate-500">24 hours, 3–5 working days, or 3–6 weeks depending on request and availability.</p></div></article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Ticket className="h-5 w-5" /></span><div><h2 className="font-bold text-navy">{isProvider ? "CCG request inbox" : "Your CCG requests"}</h2><p className="text-xs text-slate-500">{tickets.length} request{tickets.length === 1 ? "" : "s"}</p></div></div>
          {!isProvider && <Link href="/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">All tickets <ArrowRight className="h-4 w-4" /></Link>}
        </div>
        <TicketTable tickets={tickets} />
      </section>
    </div>
  );
}
