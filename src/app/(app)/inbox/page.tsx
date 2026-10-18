import { redirect } from "next/navigation";
import { TicketTriageInbox } from "@/components/tickets/ticket-triage-inbox";
import { getAllTickets, getAssignableEmployees, getCurrentContext, getTicketSlaPolicies } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

const allowedViews = ["all", "unassigned", "mine", "approval", "overdue"] as const;

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

  const supabase = await createClient();
  const [projectsResult, approversResult] = await Promise.all([
    supabase.from("projects").select("id").eq("pm_user_id", profile.id),
    supabase.from("project_approvers").select("project_id").eq("user_id", profile.id)
  ]);
  if (projectsResult.error || approversResult.error) {
    throw new Error("Could not load your project approval assignments.");
  }
  const approvableProjectIds = [
    ...(projectsResult.data ?? []).map((project) => String(project.id)),
    ...(approversResult.data ?? []).map((approver) => String(approver.project_id))
  ];
  const initialView = allowedViews.find((view) => view === params.view) ?? "all";
  const canAssign = profile.user_side === "admin" || roleNames.some((role) => ["Coordinator", "Discipline Lead"].includes(role));
  const canChangeStatus = profile.user_side === "admin" || roleNames.some((role) => ["Personnel", "Discipline Lead"].includes(role));
  const employees = canAssign ? await getAssignableEmployees() : [];

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
        approvableProjectIds={approvableProjectIds}
        slaPolicies={slaPolicies}
        employees={employees}
        canAssign={canAssign}
        canChangeStatus={canChangeStatus}
        initialView={initialView}
      />
    </div>
  );
}
