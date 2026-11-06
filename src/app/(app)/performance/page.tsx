import { redirect } from "next/navigation";
import { Activity, CalendarDays, CircleHelp, Gauge, Users } from "lucide-react";
import { getAllTickets, getAssignableEmployees, getCurrentContext, getTicketSlaPolicies } from "@/lib/data";
import { getTicketSlaIndicators } from "@/lib/utils";
import type { Profile, Ticket, TicketSlaPolicy } from "@/lib/types";

type KpiMetrics = {
  score: number | null;
  responseRate: number | null;
  resolutionRate: number | null;
  assignedCount: number;
  responseCount: number;
  resolutionCount: number;
};

function calculateKpi(tickets: Ticket[], policies: TicketSlaPolicy[], now: number): KpiMetrics {
  let responseOnTime = 0;
  let responseCount = 0;
  let resolutionOnTime = 0;
  let resolutionCount = 0;
  const workedTickets = tickets.filter((ticket) => ticket.assigned_to && ticket.status !== "rejected");

  for (const ticket of workedTickets) {
    const priorityGroup = ticket.priority === "high" || ticket.priority === "urgent" ? "high" : "standard";
    if (!policies.some((policy) => policy.priority_group === priorityGroup)) continue;

    const breaches = getTicketSlaIndicators(ticket, policies, now).filter((indicator) => indicator.state === "breached");
    const responseBreached = breaches.some((indicator) => indicator.key === "response");
    const resolutionBreached = breaches.some((indicator) => indicator.key === "resolution");

    if (ticket.first_response_at || responseBreached) {
      responseCount += 1;
      if (!responseBreached) responseOnTime += 1;
    }

    if (ticket.resolved_at || resolutionBreached) {
      resolutionCount += 1;
      if (!resolutionBreached) resolutionOnTime += 1;
    }
  }

  const responseRate = responseCount ? Math.round((responseOnTime / responseCount) * 100) : null;
  const resolutionRate = resolutionCount ? Math.round((resolutionOnTime / resolutionCount) * 100) : null;
  const availableRates = [responseRate, resolutionRate].filter((rate): rate is number => rate !== null);

  return {
    score: availableRates.length ? Math.round(availableRates.reduce((sum, rate) => sum + rate, 0) / availableRates.length) : null,
    responseRate,
    resolutionRate,
    assignedCount: workedTickets.length,
    responseCount,
    resolutionCount
  };
}

function formatScore(score: number | null) {
  return score === null ? "—" : `${score}%`;
}

function scoreTone(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 90) return "text-resolved";
  if (score >= 75) return "text-warning";
  return "text-urgent";
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: number | null; detail: string; icon: typeof Gauge }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className={`mt-3 text-3xl font-bold tracking-tight ${scoreTone(value)}`}>{formatScore(value)}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function providerLabel(provider: Profile) {
  return provider.full_name ?? provider.email ?? "Unnamed provider";
}

export default async function PerformancePage() {
  const [{ profile }, allTickets, policies] = await Promise.all([
    getCurrentContext(),
    getAllTickets(),
    getTicketSlaPolicies()
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side !== "employee" || !profile.service_team_id) redirect("/dashboard");

  const providers = await getAssignableEmployees(profile.service_team_id);
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  providerById.set(profile.id, profile);
  const teamProviders = [...providerById.values()].filter((provider) => provider.status === "active");
  const providerIds = new Set(teamProviders.map((provider) => provider.id));
  const now = Date.now();
  const periodStart = now - 90 * 24 * 60 * 60 * 1000;
  const periodTickets = allTickets.filter((ticket) => {
    const activityStartedAt = ticket.reopened_at ?? ticket.created_at;
    const createdAt = activityStartedAt ? Date.parse(activityStartedAt) : Number.NaN;
    return ticket.service_team_id === profile.service_team_id && Number.isFinite(createdAt) && createdAt >= periodStart && createdAt <= now;
  });
  const assignedTeamTickets = periodTickets.filter((ticket) => ticket.assigned_to && providerIds.has(ticket.assigned_to));
  const teamMetrics = calculateKpi(assignedTeamTickets, policies, now);
  const rows = teamProviders
    .map((provider) => ({
      provider,
      metrics: calculateKpi(assignedTeamTickets.filter((ticket) => ticket.assigned_to === provider.id), policies, now)
    }))
    .sort((left, right) => (right.metrics.score ?? -1) - (left.metrics.score ?? -1));
  const myMetrics = calculateKpi(assignedTeamTickets.filter((ticket) => ticket.assigned_to === profile.id), policies, now);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-col justify-between gap-5 rounded-3xl bg-[#172b4d] px-6 py-7 text-white shadow-[0_18px_48px_rgba(18,33,58,0.14)] sm:flex-row sm:items-end sm:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"><Activity className="h-3.5 w-3.5" /> Service provider performance</div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">KPI score</h1>
          <p className="mt-2 text-sm leading-6 text-blue-100/85 sm:text-base">Individual and team SLA performance for {profile.service_team?.name ?? "your service team"}.</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-blue-100 sm:self-auto"><CalendarDays className="h-4 w-4" />Rolling 90 days</span>
      </header>

      <section aria-label="KPI summary" className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Team KPI score" value={teamMetrics.score} detail={`${teamMetrics.assignedCount} assigned tickets in the period`} icon={Users} />
        <MetricCard label="My KPI score" value={myMetrics.score} detail={`${myMetrics.assignedCount} assigned tickets in the period`} icon={Gauge} />
        <MetricCard label="Team resolution SLA" value={teamMetrics.resolutionRate} detail={`${teamMetrics.resolutionCount} tickets with a measured resolution outcome`} icon={Activity} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="font-bold text-navy">Individual scores</h2>
          <p className="mt-1 text-sm text-slate-500">Active service providers in your team, including your own score.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead><tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><th scope="col" className="px-5 py-3 sm:px-6">Service provider</th><th scope="col" className="px-4 py-3 text-center">Assigned</th><th scope="col" className="px-4 py-3 text-center">Response SLA</th><th scope="col" className="px-4 py-3 text-center">Resolution SLA</th><th scope="col" className="px-5 py-3 text-right sm:px-6">KPI score</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ provider, metrics }) => (
                <tr key={provider.id} className="hover:bg-blue-50/30">
                  <th scope="row" className="px-5 py-4 text-sm font-semibold text-navy sm:px-6">{providerLabel(provider)}{provider.id === profile.id && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">You</span>}</th>
                  <td className="px-4 py-4 text-center text-sm text-slate-600">{metrics.assignedCount}</td>
                  <td className="px-4 py-4 text-center text-sm font-semibold text-slate-700">{formatScore(metrics.responseRate)}<span className="mt-1 block text-[10px] font-normal text-slate-400">{metrics.responseCount} measured</span></td>
                  <td className="px-4 py-4 text-center text-sm font-semibold text-slate-700">{formatScore(metrics.resolutionRate)}<span className="mt-1 block text-[10px] font-normal text-slate-400">{metrics.resolutionCount} measured</span></td>
                  <td className={`px-5 py-4 text-right text-lg font-bold sm:px-6 ${scoreTone(metrics.score)}`}>{formatScore(metrics.score)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No active team members were found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-5 text-blue-950">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>Score = the average of response SLA compliance and resolution SLA compliance. Each counts only when its outcome can be measured; open tickets with time remaining are excluded. Rejected tickets are excluded. Team score uses all assigned team tickets, while individual scores use tickets assigned to that provider. This is an operational indicator, not a complete quality or productivity rating.</p>
      </div>
    </div>
  );
}
