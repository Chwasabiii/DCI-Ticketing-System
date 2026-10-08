import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getCurrentContext, getTickets } from "@/lib/data";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  tone,
  icon: Icon
}: {
  label: string;
  value: number;
  tone: string;
  icon: typeof Inbox;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn("grid h-10 w-10 place-items-center rounded-md", tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [{ profile, roleNames }, tickets] = await Promise.all([
    getCurrentContext(),
    getTickets(100)
  ]);

  const open = tickets.filter((ticket) => !["resolved", "closed", "rejected"].includes(ticket.status)).length;
  const urgent = tickets.filter((ticket) => ticket.priority === "urgent").length;
  const resolved = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length;
  const overdue = tickets.filter((ticket) => ticket.due_date && new Date(ticket.due_date) < new Date() && !["resolved", "closed"].includes(ticket.status)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            {profile?.user_side === "client" ? "Client workspace" : roleNames.join(" / ") || profile?.user_side}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Monitor request flow, priority items, assignments, and completion status for PMSG support work.
          </p>
        </div>
        {profile?.user_side === "client" && (
          <Link
            href="/tickets/new"
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#163b68] sm:w-fit"
          >
            <PlusCircle className="h-4 w-4" />
            Submit a Ticket
          </Link>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tickets" value={open} icon={Inbox} tone="bg-blue-50 text-accent" />
        <StatCard label="Urgent" value={urgent} icon={AlertTriangle} tone="bg-red-50 text-urgent" />
        <StatCard label="Resolved" value={resolved} icon={CheckCircle2} tone="bg-green-50 text-resolved" />
        <StatCard label="Overdue" value={overdue} icon={Clock3} tone="bg-orange-50 text-warning" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">Recent tickets</h2>
            <Link href="/tickets" className="text-sm font-semibold text-accent">
              View all
            </Link>
          </div>
          <TicketTable tickets={tickets.slice(0, 8)} />
        </div>
        <div className="rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-navy">Discipline mix</h2>
          <div className="mt-4 space-y-3">
            {["Architectural", "Structural", "Mechanical", "Electrical", "Cost Control", "Documents", "IT Services", "Other Support Services"].map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="text-sm text-slate-600">{name}</span>
                <Badge value={name === "IT Services" ? "medium" : "in_progress"} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
