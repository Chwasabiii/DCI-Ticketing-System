import { redirect } from "next/navigation";
import { TicketTriageInbox } from "@/components/tickets/ticket-triage-inbox";
import { getAssignableEmployees, getCurrentContext, getInboxTickets, getTicketSlaPolicies } from "@/lib/data";

const views = ["all", "unassigned", "mine", "overdue", "resolved"] as const;
const statuses = ["open", "under_review", "assigned", "in_progress", "waiting_for_info", "resolved", "closed", "rejected"] as const;
const priorities = ["urgent", "high", "medium", "low"] as const;
const pageSize = 25;

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export default async function TriageInboxPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ profile, roleNames }, params] = await Promise.all([getCurrentContext(), searchParams]);
  if (!profile) redirect("/login");
  if (profile.user_side === "client") redirect("/tickets");
  const initialView = views.find((view) => view === getParam(params, "view")) ?? "all";
  const status = statuses.find((item) => item === getParam(params, "status"));
  const priority = priorities.find((item) => item === getParam(params, "priority"));
  const needsPriorityReview = getParam(params, "review") === "needs_review";
  const search = (getParam(params, "q") ?? "").trim().slice(0, 100);
  const requestedPage = Number(getParam(params, "page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const isItSupportProvider = profile.user_side === "employee" && profile.service_team?.slug === "it-support";
  const canAssign = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Coordinator");
  const canChangeStatus = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Personnel") || roleNames.includes("Coordinator");
  const canBulkChangeStatus = profile.user_side === "admin" || isItSupportProvider || roleNames.includes("Personnel");
  const serviceTeamId = profile.user_side === "employee" ? profile.service_team_id ?? -1 : undefined;
  const [inboxPage, employees, slaPolicies] = await Promise.all([
    getInboxTickets({
      serviceTeamId,
      view: initialView,
      status,
      priority,
      needsPriorityReview,
      search,
      page,
      pageSize
    }),
    canAssign
      ? getAssignableEmployees(profile.user_side === "employee" ? profile.service_team_id : undefined)
      : Promise.resolve([]),
    getTicketSlaPolicies()
  ]);
  const totalPages = Math.max(1, Math.ceil(inboxPage.totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePage = currentPage === page ? inboxPage : await getInboxTickets({
    serviceTeamId,
    view: initialView,
    status,
    priority,
    needsPriorityReview,
    search,
    page: currentPage,
    pageSize
  });

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
        key={`${initialView}-${status ?? ""}-${priority ?? ""}-${needsPriorityReview}-${search}-${currentPage}`}
        tickets={visiblePage.tickets}
        totalCount={visiblePage.totalCount}
        page={currentPage}
        pageSize={pageSize}
        filters={{ view: initialView, status: status ?? "all", priority: priority ?? "all", needsPriorityReview, search }}
        currentUserId={profile.id}
        slaPolicies={slaPolicies}
        employees={employees}
        canAssign={canAssign}
        canChangeStatus={canChangeStatus}
        canBulkChangeStatus={canBulkChangeStatus}
        canClaim={profile.user_side === "employee" && Boolean(profile.service_team_id)}
      />
    </div>
  );
}
