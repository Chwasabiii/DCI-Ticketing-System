"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import type { EmployeeRole, UserSide } from "@/lib/types";

export function OnboardingTips({ userId, side, roles }: { userId: string; side: UserSide; roles: EmployeeRole[] }) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const storageKey = `pmsg-onboarding-dismissed:${userId}`;
  const tips = side === "client"
    ? [{ href: "/tickets/new", label: "Submit a request" }, { href: "/tickets", label: "Track your tickets" }, { href: "/faqs", label: "Browse help articles" }]
    : side === "admin"
      ? [{ href: "/inbox", label: "Triage tickets" }, { href: "/admin/users", label: "Invite and manage users" }, { href: "/admin/sla", label: "Configure SLA targets" }]
      : [{ href: "/inbox", label: "Work from the triage inbox" }, ...(roles.includes("Manager") ? [{ href: "/reports", label: "Review reports" }] : []), ...(roles.includes("Coordinator") ? [{ href: "/workload", label: "Check team workload" }] : []), { href: "/faqs", label: "Browse support guidance" }];

  useEffect(() => {
    setVisible(localStorage.getItem(storageKey) !== "dismissed");
    setReady(true);
  }, [storageKey]);

  if (!ready || !visible) return null;
  return <aside aria-label="Getting started tips" className="animate-enter mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 sm:p-5">
    <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-sm"><Lightbulb className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-navy">Getting started</h2><p className="mt-1 text-xs text-slate-600">A few useful places to begin:</p></div><button type="button" onClick={() => { localStorage.setItem(storageKey, "dismissed"); setVisible(false); }} aria-label="Dismiss getting started tips" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap gap-2">{tips.map((tip) => <Link key={tip.href} href={tip.href} className="focus-ring rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-accent">{tip.label}</Link>)}</div></div></div>
  </aside>;
}
