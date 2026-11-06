import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { TicketWorkloadView } from "@/components/tickets/ticket-workload-view";
import { getCurrentContext } from "@/lib/data";
import { TicketDraftsList } from "@/components/tickets/ticket-drafts-list";

export default async function TicketsPage() {
  const { profile } = await getCurrentContext();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-accent">
            <Ticket className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Request center</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy sm:text-3xl">Tickets</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track updates and follow the progress of your support requests.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {profile?.user_side === "client" && (
            <Link
              href="/tickets/new"
              className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Open a ticket</span>
              <span className="sm:hidden">New</span>
            </Link>
          )}
        </div>
      </header>
      {profile?.user_side === "client" && <TicketDraftsList />}
      <TicketWorkloadView tickets={[]} currentUserId={profile?.id} />
    </div>
  );
}
