import Link from "next/link";
import { Suspense } from "react";
import { Plus, Ticket } from "lucide-react";
import { TicketWorkloadView } from "@/components/tickets/ticket-workload-view";
import { getCurrentProfile, getTickets } from "@/lib/data";
import { TicketDraftsList } from "@/components/tickets/ticket-drafts-list";

async function TicketWorkloadSection({ currentUserId }: { currentUserId?: string }) {
  const tickets = await getTickets(100);
  return <TicketWorkloadView tickets={tickets} currentUserId={currentUserId} />;
}

function TicketWorkloadSkeleton() {
  return (
    <section className="space-y-4" aria-label="Loading tickets" aria-busy="true">
      <div className="flex gap-2">
        {["w-28", "w-32", "w-24"].map((width) => <div key={width} className={`h-10 animate-pulse rounded-xl bg-slate-200 ${width}`} />)}
      </div>
      <div className="flex h-10 items-center justify-between rounded-lg bg-white/70 px-3">
        <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-100" />
        </div>
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[88px] animate-pulse border-b border-slate-100 last:border-0" />)}
      </div>
      <span className="sr-only">Loading your tickets…</span>
    </section>
  );
}

export default async function TicketsPage() {
  const profile = await getCurrentProfile();

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
      <Suspense fallback={<TicketWorkloadSkeleton />}>
        <TicketWorkloadSection currentUserId={profile?.id} />
      </Suspense>
    </div>
  );
}
