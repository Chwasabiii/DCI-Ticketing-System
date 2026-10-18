import { redirect } from "next/navigation";
import { TicketTable } from "@/components/tickets/ticket-table";
import { getCurrentContext, getTickets } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ApprovalsPage() {
  const { profile } = await getCurrentContext();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [projectsResult, approversResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id")
      .eq("pm_user_id", profile.id),
    supabase
      .from("project_approvers")
      .select("project_id")
      .eq("user_id", profile.id)
  ]);
  if (projectsResult.error) {
    throw new Error(`Could not load projects for approval: ${projectsResult.error.message}`);
  }
  if (approversResult.error) {
    throw new Error(`Could not load project approver assignments: ${approversResult.error.message}`);
  }

  const projectIds = new Set([
    ...(projectsResult.data ?? []).map((project) => String(project.id)),
    ...(approversResult.data ?? []).map((approver) => String(approver.project_id))
  ]);
  const tickets = projectIds.size
    ? (await getTickets(500)).filter(
        (ticket) =>
          ticket.approval_status === "pending" &&
          ticket.project_id !== null &&
          projectIds.has(String(ticket.project_id))
      )
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Project approvals</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review project-linked requests assigned to you as PM or designated approver.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
