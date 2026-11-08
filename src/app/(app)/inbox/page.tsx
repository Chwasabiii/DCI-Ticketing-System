import { redirect } from "next/navigation";
import { TicketTriageInbox } from "@/components/tickets/ticket-triage-inbox";
import { getAssignableEmployees, getCurrentContext, getInboxTickets, getTicketSlaPolicies } from "@/lib/data";

const allowedViews = ["all", "unassigned", "mine", "overdue"] as const;

export default async function TriageInboxPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ profile, roleNames }, slaPolicies, params] = await Promise.all([
    getCurrentContext(),
    getTicketSlaPolicies(),
    searchParams
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side === "client") redirect("/tickets");
  const initialView = allowedViews.find((view) => view === params.view) ?? "all";
  const isItSupportProvider = profile.user_side === "employee" && profile.service_team?.slug === "it-support";
  const canAssign = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Coordinator");
  const canChangeStatus = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Personnel") || roleNames.includes("Coordinator");
  const canBulkChangeStatus = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Personnel");
  const [tickets, employees] = await Promise.all([
    getInboxTickets(profile.user_side === "employee" ? profile.service_team_id ?? -1 : undefined),
    canAssign
      ? getAssignableEmployees(profile.user_side === "employee" ? profile.service_team_id : undefined)
      : Promise.resolve([])
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Staff workspace</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Triage inbox</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Find tickets that need a decision or action. {profile.user_side === "employee" ? "IT Support providers can assign tickets and update status; other service providers can claim eligible tickets and use actions granted by their roles." : "Your access rules still limit which tickets appear."}
        </p>
      </header>
      <TicketTriageInbox
        tickets={tickets}
        currentUserId={profile.id}
        slaPolicies={slaPolicies}
        employees={employees}
        canAssign={canAssign}
        canChangeStatus={canChangeStatus}
        canBulkChangeStatus={canBulkChangeStatus}
        canClaim={profile.user_side === "employee" && Boolean(profile.service_team_id)}
        initialView={initialView}
      />
    </div>
  );
}
