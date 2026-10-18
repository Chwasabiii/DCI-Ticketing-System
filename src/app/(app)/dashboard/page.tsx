import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeHelp,
  CheckCircle2,
  Clock3,
  Plus,
  Ticket,
  Timer
} from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { TicketReports } from "@/components/reports/ticket-reports";
import { getAllTickets, getCurrentContext } from "@/lib/data";
import { isTicketOverdue } from "@/lib/utils";

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
  const [{ profile, roleNames }, tickets] = await Promise.all([
    getCurrentContext(),
    getAllTickets()
  ]);

  const active = tickets.filter(
    (ticket) => !["resolved", "closed", "rejected"].includes(ticket.status)
  );
  const urgent = active.filter((ticket) => ticket.priority === "urgent").length;
  const resolved = tickets.filter(
    (ticket) => ticket.status === "resolved" || ticket.status === "closed"
  ).length;
  const overdue = active.filter((ticket) => isTicketOverdue(ticket)).length;
  const roleLabel =
    profile?.user_side === "client"
      ? "Your support workspace"
      : roleNames.join(" · ") || profile?.user_side || "Support workspace";

  return (
    <div className="mx-auto max-w-[1400px] space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#172b4d] px-6 py-7 text-white shadow-[0_18px_48px_rgba(18,33,58,0.18)] sm:px-9 sm:py-9">
        <div className="absolute -right-10 -top-28 -z-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-[-7rem] right-[22%] -z-10 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {roleLabel}
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100/85 sm:text-base">
              Everything you need to request help and keep project support moving, all in one place.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/tickets/new"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-navy shadow-sm transition-colors hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
              Open a ticket
            </Link>
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
          href={profile?.user_side === "client" ? "/tickets" : "/inbox?view=overdue"}
          icon={Clock3}
          tone="bg-amber-50 text-warning"
        />
      </section>

      <TicketReports
        tickets={tickets}
        canExport={profile?.user_side === "admin" && profile.status === "active"}
      />

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
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
          <TicketTable tickets={tickets.slice(0, 8)} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <Timer className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-navy">Need help?</h2>
                <p className="text-xs text-slate-500">We’re here to keep work moving.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Open a ticket for project support, report an incident, or ask for access.
            </p>
            <Link
              href="/tickets/new"
              className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start a request <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <Link
            href="/faqs"
            className="group flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 transition-colors hover:bg-blue-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-sm">
              <BadgeHelp className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold text-navy">Explore the help center</span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">
                Find quick answers to common questions.
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent">
                Browse FAQs <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>

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
