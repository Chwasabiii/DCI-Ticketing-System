"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileEdit,
  Plus,
  RefreshCw,
  Ticket as TicketIcon
} from "lucide-react";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import { readTicketDrafts, type TicketDraft } from "@/lib/ticket-drafts";
import { formatDate, formatDateTime, getTicketResolutionDueLabel } from "@/lib/utils";

const activeStatuses = new Set(["open", "under_review", "assigned", "in_progress", "waiting_for_info"]);

const statusStyles: Record<string, string> = {
  open: "bg-blue-50 text-blue-800 ring-blue-200",
  under_review: "bg-amber-50 text-amber-800 ring-amber-200",
  assigned: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
  waiting_for_info: "bg-orange-50 text-orange-800 ring-orange-200",
  resolved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200"
};

function displayStatus(status: string) {
  if (status === "waiting_for_info") return "Waiting for your reply";
  return status.replaceAll("_", " ");
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href
}: {
  label: string;
  value: number | string;
  icon: typeof TicketIcon;
  tone: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      </span>
      <span className="mt-3 block text-3xl font-bold tracking-tight text-navy">{value}</span>
    </>
  );
  const className = "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-5";
  return href
    ? <Link href={href} className={`${className} transition hover:-translate-y-0.5 hover:shadow-soft focus-ring`}>{content}</Link>
    : <div className={className}>{content}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" aria-busy="true">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <div className="mt-4 h-10 animate-pulse rounded-lg bg-slate-100" />
      <span className="sr-only">Loading {label.toLocaleLowerCase()}…</span>
    </div>
  );
}

export function EndUserDashboard({
  name,
  tickets = [],
  slaPolicies = [],
  loadError = null
}: {
  name: string | null;
  tickets?: Ticket[];
  slaPolicies?: TicketSlaPolicy[];
  loadError?: string | null;
}) {
  const [drafts, setDrafts] = useState<TicketDraft[]>([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drafts live in localStorage, so hydrate them only in the browser and refresh on cross-tab edits.
  useEffect(() => {
    const refreshDrafts = () => {
      setDrafts(readTicketDrafts());
      setDraftsLoaded(true);
    };
    refreshDrafts();
    window.addEventListener("storage", refreshDrafts);
    return () => window.removeEventListener("storage", refreshDrafts);
  }, []);

  const pendingTickets = tickets.filter((ticket) => activeStatuses.has(ticket.status));
  const completedTickets = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed");
  const rejectedTickets = tickets.filter((ticket) => ticket.status === "rejected");
  const needsReply = tickets.filter((ticket) => ticket.status === "waiting_for_info");
  const needsResolutionReview = tickets.filter((ticket) => ticket.status === "resolved");
  const attentionTickets = [...needsReply, ...needsResolutionReview].slice(0, 4);
  const recentTickets = tickets.slice(0, 5);
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <header className="relative isolate overflow-hidden rounded-3xl bg-[#172b4d] px-5 py-6 text-white shadow-[0_18px_48px_rgba(18,33,58,0.18)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(ellipse at 86% 12%, rgba(96, 165, 250, 0.2), transparent 42%), radial-gradient(ellipse at 55% 115%, rgba(16, 185, 129, 0.12), transparent 40%)" }} />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-200">Your support dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome{firstName ? `, ${firstName}` : ""}</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100/90 sm:text-base">
              {loadError
                ? "Your request summary could not be loaded."
                : `You have ${pendingTickets.length} pending ${pendingTickets.length === 1 ? "request" : "requests"}${draftsLoaded ? ` and ${drafts.length} saved ${drafts.length === 1 ? "draft" : "drafts"}` : ""}.`}
            </p>
          </div>
          <Link href="/tickets/new" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-navy shadow-sm transition hover:bg-blue-50">
            <Plus className="h-4 w-4" /> Create a request
          </Link>
        </div>
      </header>

      {loadError && (
        <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">We couldn’t load your requests.</p>
            <p className="mt-1 text-xs">{loadError}</p>
          </div>
          <button type="button" onClick={() => { setIsRefreshing(true); window.location.reload(); }} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold hover:bg-rose-100">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> Try again
          </button>
        </section>
      )}

      {!loadError && <section aria-label="Your request summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="All requests" value={tickets.length} icon={TicketIcon} tone="bg-blue-50 text-accent" href="/tickets" />
        <StatCard label="Pending" value={pendingTickets.length} icon={Clock3} tone="bg-amber-50 text-amber-800" href="/tickets" />
        <StatCard label="Completed" value={completedTickets.length} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" href="/tickets" />
        <StatCard label="Rejected" value={rejectedTickets.length} icon={AlertCircle} tone="bg-rose-50 text-rose-700" href="/tickets" />
        {draftsLoaded
          ? <StatCard label="Saved drafts" value={drafts.length} icon={FileEdit} tone="bg-violet-50 text-violet-700" href="/tickets" />
          : <LoadingPanel label="Saved drafts" />}
      </section>}

      {!loadError && attentionTickets.length > 0 && (
        <section aria-labelledby="request-attention-title" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-800 shadow-sm"><AlertCircle className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="request-attention-title" className="font-bold text-navy">Needs your attention</h2>
              <p className="mt-1 text-sm text-slate-600">These requests are waiting for your reply or completion confirmation.</p>
              <ul className="mt-3 divide-y divide-amber-200/70">
                {attentionTickets.map((ticket) => (
                  <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy">{ticket.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-600">{ticket.ticket_no ?? `Ticket #${ticket.id}`} · {ticket.status === "resolved" ? "Review the resolution" : "Please reply to the support team"}</span>
                    </span>
                    <Link href={`/tickets/${ticket.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-accent ring-1 ring-amber-200 hover:bg-amber-100">
                      {ticket.status === "resolved" ? "Review request" : "Open and reply"} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        <section aria-labelledby="drafts-title" className="rounded-2xl border border-violet-200 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><FileEdit className="h-5 w-5" /></span>
            <div><h2 id="drafts-title" className="font-bold text-navy">Saved drafts</h2><p className="text-xs text-slate-500">Saved on this device</p></div>
          </div>
          {!draftsLoaded ? <div className="mt-4 h-12 animate-pulse rounded-lg bg-slate-100" aria-label="Loading saved drafts" /> : drafts.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {drafts.slice(0, 3).map((draft) => (
                <li key={draft.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy">{draft.title.trim() || "Untitled request"}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{draft.teamSlug === "cost-control" ? "Cost Control Group" : "IT Support"} · Saved {formatDateTime(draft.updatedAt)}</span>
                  </span>
                  <Link href={`/tickets/new?team=${encodeURIComponent(draft.teamSlug)}&draft=${encodeURIComponent(draft.id)}`} className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-violet-200 px-3 text-xs font-bold text-violet-800 hover:bg-violet-50">Continue</Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-4">
              <p className="text-sm text-slate-600">No drafts saved yet. Your request is saved automatically as you type.</p>
              <Link href="/tickets/new" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Start a request <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
        </section>

        <section aria-label="Quick links" className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <Link href="/it-support" className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-soft">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><TicketIcon className="h-5 w-5" /></span><span><span className="block text-sm font-bold text-navy">IT Support</span><span className="mt-0.5 block text-xs text-slate-500">Devices, systems, access</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/cost-control" className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-soft">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><TicketIcon className="h-5 w-5" /></span><span><span className="block text-sm font-bold text-navy">Cost Control Group</span><span className="mt-0.5 block text-xs text-slate-500">Rates, vendors, documents</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-emerald-800 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/faqs" className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 transition hover:bg-blue-50">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-accent shadow-sm"><BookOpen className="h-5 w-5" /></span><span><span className="block text-sm font-bold text-navy">Help center</span><span className="mt-0.5 block text-xs text-slate-600">Browse FAQs and answers</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/tickets" className="group flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 transition hover:bg-violet-50">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-violet-700 shadow-sm"><TicketIcon className="h-5 w-5" /></span><span><span className="block text-sm font-bold text-navy">My requests</span><span className="mt-0.5 block text-xs text-slate-600">View statuses and updates</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-violet-700 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>
      </div>

      <section aria-labelledby="recent-requests-title" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-accent">Your activity</p>
              <h2 id="recent-requests-title" className="mt-1 text-lg font-bold text-navy">Recent requests</h2>
            </div>
            <Link href="/tickets" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-blue-50">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {loadError ? (
            <p role="status" className="px-5 py-8 text-center text-sm text-slate-600">Request activity is unavailable until the dashboard can reconnect.</p>
          ) : recentTickets.length ? (
            <ul className="divide-y divide-slate-100">
              {recentTickets.map((ticket) => {
                const deadline = activeStatuses.has(ticket.status) ? getTicketResolutionDueLabel(ticket, slaPolicies) : null;
                const showDeadline = deadline && deadline !== "SLA target not set" && deadline !== "CCG service deadline";
                return (
                  <li key={ticket.id}>
                    <Link href={`/tickets/${ticket.id}`} className="block p-4 transition hover:bg-slate-50/80 focus-ring sm:px-5">
                      <span className="flex flex-wrap items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-navy">{ticket.title}</span>
                          <span className="mt-1 block text-xs text-slate-500">{ticket.ticket_no ?? `Ticket #${ticket.id}`} · Opened {formatDate(ticket.created_at)}</span>
                        </span>
                        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[ticket.status] ?? "bg-slate-100 text-slate-700 ring-slate-300"}`}>
                          {displayStatus(ticket.status)}
                        </span>
                      </span>
                      {showDeadline && <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${deadline.startsWith("Overdue") ? "text-rose-700" : "text-slate-500"}`}><Clock3 className="h-3.5 w-3.5" />{deadline}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-accent"><TicketIcon className="h-5 w-5" /></span>
              <h3 className="mt-3 font-bold text-navy">No requests yet</h3>
              <p className="mt-1 text-sm text-slate-600">Create your first request and it will appear here.</p>
              <Link href="/tickets/new" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Create a request</Link>
            </div>
          )}
      </section>
    </div>
  );
}
