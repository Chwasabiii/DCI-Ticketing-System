import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, Ticket } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getAllTickets, getCurrentContext, getServiceTeams } from "@/lib/data";

export default async function ITSupportPage() {
  const [{ profile }, teams, allTickets] = await Promise.all([
    getCurrentContext(),
    getServiceTeams({ inScopeOnly: true }),
    getAllTickets()
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side === "employee" && profile.service_team?.slug !== "it-support") redirect("/dashboard");
  if (profile.user_side === "admin") redirect("/dashboard");

  const team = teams.find((item) => item.slug === "it-support");
  if (!team) throw new Error("The IT Support service team is not configured.");
  const tickets = allTickets.filter((ticket) => ticket.service_team_id === team.id);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-[#172b4d] p-6 text-white sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-200">Service team</p>
          <h1 className="mt-2 text-3xl font-bold">IT Support Department</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Get help with accounts, devices, software, access, and technical incidents.</p>
        </div>
        <Link href="/tickets/new?team=it-support" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-navy hover:bg-blue-50"><Plus className="h-4 w-4" />New IT request</Link>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><Ticket className="h-5 w-5" /></span><div><h2 className="font-bold text-navy">Your IT Support tickets</h2><p className="text-xs text-slate-500">{tickets.length} request{tickets.length === 1 ? "" : "s"}</p></div></div>
          <Link href="/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">All tickets <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <TicketTable tickets={tickets} />
      </section>
    </div>
  );
}
