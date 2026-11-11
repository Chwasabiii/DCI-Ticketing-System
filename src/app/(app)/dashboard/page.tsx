import { redirect } from "next/navigation";
import { EndUserDashboard } from "@/components/dashboard/end-user-dashboard";
import { ServiceDashboard } from "@/components/dashboard/service-dashboard";
import {
  getCurrentContext,
  getDashboardTickets,
  getServiceDashboardMetrics,
  getServiceTeams,
  getTicketSlaPolicies
} from "@/lib/data";
import { allDepartmentsConfig, getServiceDepartmentConfig } from "@/lib/service-departments";
import { measureTiming } from "@/lib/supabase/timing";

type DashboardPageProps = {
  searchParams: Promise<{ team?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { profile } = await measureTiming("/dashboard", "dashboard.auth-profile-check", getCurrentContext);
  if (!profile) redirect("/login");

  if (profile.user_side === "client") {
    let tickets;
    let slaPolicies;
    let loadError: string | null = null;
    try {
      [tickets, slaPolicies] = await Promise.all([
        measureTiming("/dashboard", "dashboard.tickets", getDashboardTickets),
        measureTiming("/dashboard", "dashboard.sla-policies", getTicketSlaPolicies)
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

  const params = await searchParams;
  const isAdmin = profile.user_side === "admin";
  const teams = isAdmin
    ? await measureTiming("/dashboard", "dashboard.service-teams", getServiceTeams)
    : [];
  const requestedTeamId = isAdmin && params.team && /^\d+$/.test(params.team)
    ? Number(params.team)
    : null;
  const selectedTeam = requestedTeamId
    ? teams.find((team) => team.id === requestedTeamId) ?? null
    : null;
  const selectedTeamId = selectedTeam?.id ?? null;
  const serviceTeamId = isAdmin
    ? selectedTeamId ?? undefined
    : profile.service_team_id ?? -1;

  const [tickets, slaPolicies, metrics] = await Promise.all([
    measureTiming("/dashboard", "dashboard.tickets", () => getDashboardTickets(serviceTeamId)),
    measureTiming("/dashboard", "dashboard.sla-policies", getTicketSlaPolicies),
    measureTiming("/dashboard", "dashboard.metrics", () => getServiceDashboardMetrics(serviceTeamId))
  ]);
  const department = isAdmin
    ? selectedTeam
      ? getServiceDepartmentConfig(selectedTeam.slug, selectedTeam.name)
      : allDepartmentsConfig
    : getServiceDepartmentConfig(profile.service_team?.slug, profile.service_team?.name);

  return (
    <ServiceDashboard
      tickets={tickets}
      currentUserId={profile.id}
      department={department}
      slaPolicies={slaPolicies}
      metrics={metrics}
      isAdmin={isAdmin}
      teams={teams}
      selectedTeamId={selectedTeamId}
    />
  );
}
