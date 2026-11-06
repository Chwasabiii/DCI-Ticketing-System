import { redirect } from "next/navigation";
import { Info, Workflow } from "lucide-react";
import { getCurrentContext } from "@/lib/data";

type RaciCode = "R" | "A" | "C" | "I" | "R/A" | "—";

const columns = ["Employee", "Personnel", "Coordinator", "Manager", "Admin", "System"] as const;

const activities: Array<{
  name: string;
  description: string;
  assignments: Record<(typeof columns)[number], RaciCode>;
}> = [
  {
    name: "Submit a support request",
    description: "Describe the issue, impact, urgency, and requested outcome.",
    assignments: { Employee: "R", Personnel: "I", Coordinator: "I", Manager: "I", Admin: "I", System: "—" }
  },
  {
    name: "Review and classify the request",
    description: "Verify the request type and adjust reported impact or urgency before priority affects SLA targets.",
    assignments: { Employee: "C", Personnel: "R/A", Coordinator: "C", Manager: "I", Admin: "I", System: "—" }
  },
  {
    name: "Calculate ticket priority",
    description: "Apply the impact and urgency matrix to provider-confirmed values.",
    assignments: { Employee: "I", Personnel: "A", Coordinator: "C", Manager: "I", Admin: "I", System: "R" }
  },
  {
    name: "Assign the ticket to a service provider",
    description: "Select the team member who will take ownership of the work.",
    assignments: { Employee: "I", Personnel: "I", Coordinator: "R/A", Manager: "C", Admin: "I", System: "—" }
  },
  {
    name: "Investigate and deliver the work",
    description: "Work the ticket, document progress, and ask for missing information.",
    assignments: { Employee: "C", Personnel: "R", Coordinator: "A", Manager: "I", Admin: "I", System: "—" }
  },
  {
    name: "Resolve the ticket",
    description: "Record the outcome and mark the work resolved for requester review.",
    assignments: { Employee: "I", Personnel: "R", Coordinator: "A", Manager: "I", Admin: "I", System: "—" }
  },
  {
    name: "Confirm completion and close",
    description: "Review the resolution and close the request when the outcome is acceptable.",
    assignments: { Employee: "R/A", Personnel: "I", Coordinator: "I", Manager: "I", Admin: "I", System: "—" }
  },
  {
    name: "Monitor workload and service levels",
    description: "Review team capacity, overdue work, and SLA performance.",
    assignments: { Employee: "I", Personnel: "C", Coordinator: "C", Manager: "R/A", Admin: "I", System: "R" }
  },
  {
    name: "Manage accounts and system-wide settings",
    description: "Maintain access, user accounts, and organization-wide configuration.",
    assignments: { Employee: "I", Personnel: "I", Coordinator: "C", Manager: "C", Admin: "R/A", System: "—" }
  }
];

function AssignmentMark({ code }: { code: RaciCode }) {
  if (code === "—") return <span className="text-slate-300">—</span>;
  const color = code.includes("A")
    ? "bg-violet-50 text-violet-700 ring-violet-200"
    : code === "R"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : code === "C"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex min-w-8 justify-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${color}`}>{code}</span>;
}

export default async function RaciMatrixPage() {
  const { profile } = await getCurrentContext();
  if (!profile) redirect("/login");
  if (profile.user_side === "client") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-col justify-between gap-5 rounded-3xl bg-[#172b4d] px-6 py-7 text-white shadow-[0_18px_48px_rgba(18,33,58,0.14)] sm:flex-row sm:items-end sm:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
            <Workflow className="h-3.5 w-3.5" /> Team operating guide
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">RACI matrix</h1>
          <p className="mt-2 text-sm leading-6 text-blue-100/85 sm:text-base">
            A shared view of who owns each step in the support ticket lifecycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="RACI legend">
          {[
            ["R", "Responsible"],
            ["A", "Accountable"],
            ["C", "Consulted"],
            ["I", "Informed"]
          ].map(([code, label]) => (
            <span key={code} className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-medium text-white">
              <span className="grid h-5 w-5 place-items-center rounded bg-white text-xs font-bold text-navy">{code}</span>
              {label}
            </span>
          ))}
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-5 text-blue-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>This is a proposed operating model based on the roles and workflow currently in PMSG Desk. RACI clarifies ownership; application and database permissions still control what each role can do.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]" aria-label="Ticket lifecycle RACI assignments">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="font-bold text-navy">Ticket lifecycle responsibilities</h2>
          <p className="mt-1 text-sm text-slate-500">Each activity has a clear owner and supporting roles.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th scope="col" className="sticky left-0 z-10 min-w-[310px] border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">Activity</th>
                {columns.map((column) => <th scope="col" key={column} className="min-w-28 border-b border-slate-200 px-3 py-3 text-center">{column}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((activity) => (
                <tr key={activity.name} className="transition-colors hover:bg-blue-50/30">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-5 py-4 text-left sm:px-6">
                    <span className="block text-sm font-semibold text-navy">{activity.name}</span>
                    <span className="mt-1 block max-w-sm text-xs font-normal leading-5 text-slate-500">{activity.description}</span>
                  </th>
                  {columns.map((column) => <td key={column} className="px-3 py-4 text-center"><AssignmentMark code={activity.assignments[column]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">One role can be both Responsible and Accountable (R/A). A dash means the role has no direct part in that activity.</p>
      </section>
    </div>
  );
}
