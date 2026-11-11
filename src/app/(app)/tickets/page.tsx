import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { TicketWorkloadView } from "@/components/tickets/ticket-workload-view";
import { getCurrentProfile, getTicketSlaPolicies, getTickets } from "@/lib/data";
import { TicketDraftsList } from "@/components/tickets/ticket-drafts-list";
import { measureTiming } from "@/lib/supabase/timing";

async function TicketWorkloadSection({ currentUserId, canCreateTickets }: { currentUserId?: string; canCreateTickets: boolean }) {
  const [tickets, slaPolicies] = await Promise.all([
    measureTiming("/tickets", "tickets.list", () => getTickets(100)),
    measureTiming("/tickets", "tickets.sla-policies", getTicketSlaPolicies)
  ]);
  return <TicketWorkloadView tickets={tickets} currentUserId={currentUserId} slaPolicies={slaPolicies} canCreateTickets={canCreateTickets} />;
}

function TicketWorkloadSkeleton() {
  return (
    <section className="space-y-3" aria-label="Loading tickets" aria-busy="true">
      <div className="flex gap-2">
        {["w-24", "w-28", "w-20"].map((width) => <div key={width} className={`h-9 animate-pulse rounded-control bg-slate-200 ${width}`} />)}
      </div>
      <div className="overflow-hidden rounded-control border border-border bg-surface">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-48 animate-pulse rounded-control bg-slate-100" />
        </div>
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-12 animate-pulse border-b border-border last:border-0" />)}
      </div>
      <span className="sr-only">Loading tickets…</span>
    </section>
  );
}

export default async function TicketsPage() {
  const profile = await measureTiming("/tickets", "tickets.auth-profile-check", getCurrentProfile);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Tickets</h1>
          <p className="mt-1 text-sm text-muted">Search and filter support requests.</p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          {profile?.user_side === "client" && (
            <Link
              href="/tickets/new"
              className="focus-ring inline-flex min-h-9 shrink-0 items-center gap-2 rounded-control bg-accent-strong px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          )}
        </div>
      </header>
      {profile?.user_side === "client" && <TicketDraftsList />}
      <Suspense fallback={<TicketWorkloadSkeleton />}>
        <TicketWorkloadSection currentUserId={profile?.id} canCreateTickets={profile?.user_side === "client"} />
      </Suspense>
    </div>
  );
}
