"use client";

import { Download } from "lucide-react";

export function TicketReportExportButton({ href }: { href: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.assign(href)}
      className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-navy hover:bg-slate-50"
    >
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
