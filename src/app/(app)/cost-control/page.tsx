import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calculator, Clock3 } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getAllTickets, getCurrentContext, getServiceTeams } from "@/lib/data";

export default async function CostControlPage() {
  const [{ profile }, teams, allTickets] = await Promise.all([
    getCurrentContext(),
    getServiceTeams({ inScopeOnly: true }),
    getAllTickets()
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side === "employee" && profile.service_team?.slug !== "cost-control") redirect("/dashboard");
  if (profile.user_side === "admin") redirect("/dashboard");

  const team = teams.find((item) => item.slug === "cost-control");
  if (!team) throw new Error("The Cost Control Group service team is not configured.");
  const tickets = allTickets.filter((ticket) => ticket.service_team_id === team.id);
  const isProvider = profile.user_side === "employee";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#173d38] to-[#26745f] p-6 text-white shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10"><Calculator className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-100">Service team</p>
            <h1 className="mt-2 text-3xl font-bold">Cost Control Group</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">{isProvider ? "Your Cost Control Group workspace." : "Your dedicated space for Cost Control Group requests."}</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-bold text-navy">CCG workflow is being prepared</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This tab is ready for Cost Control Group. Its request form, review stages, and dashboard measures will be added when the CCG workflow is defined.</p>
            <p className="mt-4 text-sm font-semibold text-emerald-800">There are {tickets.length} Cost Control Group ticket{tickets.length === 1 ? "" : "s"} visible to you.</p>
            {!isProvider && <Link href="/it-support" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">Go to IT Support <ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
      </section>

      {tickets.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="mb-4 font-bold text-navy">Existing CCG tickets</h2><TicketTable tickets={tickets} /></section>}
    </div>
  );
}
