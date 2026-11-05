import { redirect } from "next/navigation";
import { TicketTriageInbox } from "@/components/tickets/ticket-triage-inbox";
import { getAllTickets, getAssignableEmployees, getCurrentContext, getTicketSlaPolicies } from "@/lib/data";

const allowedViews = ["all", "unassigned", "mine", "overdue"] as const;

export default async function TriageInboxPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ profile, roleNames }, tickets, slaPolicies, params] = await Promise.all([
    getCurrentContext(),
    getAllTickets(),
    getTicketSlaPolicies(),
    searchParams
  ]);
  if (!profile) redirect("/login");
  if (profile.user_side === "client") redirect("/tickets");

  const initialView = allowedViews.find((view) => view === params.view) ?? "all";
  const canAssign = profile.user_side === "admin" || roleNames.includes("Coordinator");
  const canChangeStatus = profile.user_side === "admin" || roleNames.includes("Personnel");
  const employees = canAssign
    ? await getAssignableEmployees(profile.user_side === "employee" ? profile.service_team_id : undefined)
    : [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Staff workspace</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Triage inbox</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Find tickets that need a decision or action. Your access rules still limit which tickets appear.
        </p>
      </header>
      <TicketTriageInbox
        tickets={tickets}
        currentUserId={profile.id}
        slaPolicies={slaPolicies}
        employees={employees}
        canAssign={canAssign}
        canChangeStatus={canChangeStatus}
        initialView={initialView}
      />
    </div>
  );
}
