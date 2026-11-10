import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Ticket,
} from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { TicketReports } from "@/components/reports/ticket-reports";
import { CostControlDashboard } from "@/components/tickets/cost-control-dashboard";
import { getDashboardTickets, getCurrentContext, getTicketSlaPolicies } from "@/lib/data";
import { isTicketResolutionOverdue } from "@/lib/utils";
import { EndUserDashboard } from "@/components/dashboard/end-user-dashboard";

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  tone
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Ticket;
  href: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)] transition-all hover:-translate-y-0.5 hover:shadow-soft focus-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-navy">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">{detail}</span>
        <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-accent" />
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const { profile, roleNames } = await getCurrentContext();
  if (profile?.user_side === "client") {
    let tickets;
    let slaPolicies;
    let loadError: string | null = null;
    try {
      [tickets, slaPolicies] = await Promise.all([
        getDashboardTickets(),
        getTicketSlaPolicies()
      ]);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "An unexpected error occurred.";
    }
    return (
      <EndUserDashboard
        name={profile.full_name}
        tickets={tickets}
        slaPolicies={slaPolicies}
        loadError={loadError}
      />
    );
  }

  const slaPolicies = await getTicketSlaPolicies();
  const tickets = await getDashboardTickets(
    profile?.user_side === "employee" ? profile.service_team_id ?? -1 : undefined
  );

  if (profile?.user_side === "employee" && profile.service_team?.slug === "cost-control") {
    return <CostControlDashboard tickets={tickets} name={profile.full_name} slaPolicies={slaPolicies} />;
  }

  const visibleTickets = tickets;
  const active = visibleTickets.filter(
    (ticket) => !["resolved", "closed", "rejected"].includes(ticket.status)
  );
  const urgent = active.filter((ticket) => ticket.priority === "urgent").length;
  const resolved = visibleTickets.filter(
    (ticket) => ticket.status === "resolved" || ticket.status === "closed"
  ).length;
  const overdue = active.filter((ticket) => isTicketResolutionOverdue(ticket, slaPolicies)).length;
  const roleLabel = roleNames.join(" · ") || profile?.user_side || "Support workspace";

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#172b4d] px-6 py-7 text-white shadow-[0_18px_48px_rgba(18,33,58,0.18)] sm:px-9 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: "radial-gradient(ellipse at 85% 15%, rgba(96, 165, 250, 0.2), transparent 42%), radial-gradient(ellipse at 62% 110%, rgba(129, 140, 248, 0.12), transparent 40%)" }}
        />
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {profile?.user_side === "employee" ? profile.service_team?.name ?? roleLabel : roleLabel}
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/85 sm:text-base">
              Everything you need to request help and keep work moving, all in one place.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {profile?.user_side === "employee" && (
              <Link
                href="/performance"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                <BarChart3 className="h-4 w-4" />
                KPI score
              </Link>
            )}
            <Link
              href="/tickets"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Ticket className="h-4 w-4" />
              Browse tickets
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Ticket overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={active.length}
          detail="Requests still in progress"
          href="/tickets"
          icon={Ticket}
          tone="bg-blue-50 text-accent"
        />
        <StatCard
          label="Urgent"
          value={urgent}
          detail="High-priority attention"
          href="/tickets"
          icon={AlertCircle}
          tone="bg-rose-50 text-urgent"
        />
        <StatCard
          label="Resolved"
          value={resolved}
          detail="Completed requests"
          href="/tickets"
          icon={CheckCircle2}
          tone="bg-emerald-50 text-resolved"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          detail="Past their due date"
          href="/inbox?view=overdue"
          icon={Clock3}
          tone="bg-amber-50 text-warning"
        />
      </section>

      <TicketReports
        tickets={visibleTickets}
        canExport={profile?.user_side === "admin" && profile.status === "active"}
        slaPolicies={slaPolicies}
      />

      <section className={`grid items-start gap-6 ${urgent > 0 ? "xl:grid-cols-[minmax(0,1fr)_300px]" : "xl:grid-cols-1"}`}>
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Your workspace</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-navy">Recent tickets</h2>
            </div>
            <Link href="/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        <TicketTable tickets={visibleTickets.slice(0, 8)} slaPolicies={slaPolicies} />
        </div>

        <aside className="space-y-4">
          {urgent > 0 && (
            <div className="flex gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-urgent" />
              <p className="text-sm leading-5 text-rose-900">
                <span className="font-bold">{urgent} urgent {urgent === 1 ? "ticket needs" : "tickets need"}</span>{" "}
                attention.
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
