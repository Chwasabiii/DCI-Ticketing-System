import Link from "next/link";
import { ArrowRight, BarChart3, Calculator, Clock3, FileText } from "lucide-react";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import { TicketTable } from "@/components/tickets/ticket-table";

export function CostControlDashboard({ tickets, name, slaPolicies = [] }: { tickets: Ticket[]; name: string | null; slaPolicies?: TicketSlaPolicy[] }) {
  const active = tickets.filter((ticket) => !["resolved", "closed", "rejected"].includes(ticket.status));
  const waiting = tickets.filter((ticket) => ticket.status === "waiting_for_info");
  const resolved = tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#173d38] via-[#1f6553] to-[#23866b] p-6 text-white shadow-[0_18px_48px_rgba(18,33,58,0.16)] sm:p-9">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50"><Calculator className="h-4 w-4" />Cost Control Group workspace</span>
            <h1 className="mt-5 text-3xl font-bold sm:text-4xl">Welcome{ name ? `, ${name.split(" ")[0]}` : ""}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50">Track Cost Control Group requests, workload, and service level performance.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/performance" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"><BarChart3 className="h-4 w-4" />KPI score</Link>
            <Link href="/inbox" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-50">Open team inbox <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <section aria-label="Cost Control Group ticket summary" className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active CCG tickets", value: active.length, icon: FileText, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Waiting for information", value: waiting.length, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
          { label: "Resolved", value: resolved.length, icon: Calculator, tone: "bg-blue-50 text-blue-700" }
        ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><span><span className="block text-2xl font-bold text-navy">{value}</span><span className="text-sm text-slate-500">{label}</span></span></div>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Cost Control Group</p><h2 className="mt-1 text-xl font-bold text-navy">Recent team tickets</h2></div><Link href="/inbox" className="text-sm font-semibold text-accent hover:underline">Go to inbox</Link></div>
        <TicketTable tickets={tickets.slice(0, 8)} slaPolicies={slaPolicies} />
      </section>
    </div>
  );
}
