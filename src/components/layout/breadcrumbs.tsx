"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/navigation";

export function Breadcrumbs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  const matched = [...items].sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const parts: Array<{ label: string; href?: string }> = [{ label: "Home", href: "/dashboard" }];
  if (matched) {
    parts.push({ label: matched.label, href: pathname === matched.href ? undefined : matched.href });
    if (pathname.startsWith("/tickets/") && pathname !== "/tickets/new") {
      parts.push({ label: "Ticket details" });
    } else if (pathname.startsWith("/admin/")) {
      const leaf = pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ");
      if (leaf && leaf !== matched.label.toLowerCase()) parts.push({ label: leaf.replace(/\b\w/g, (letter) => letter.toUpperCase()) });
    }
  }
  return <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
    {parts.map((part, index) => <span key={`${part.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
      {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
      {part.href ? <Link href={part.href} className="inline-flex items-center gap-1 rounded-sm hover:text-accent focus-ring">{index === 0 && <Home className="h-3.5 w-3.5" />}{part.label}</Link> : <span aria-current="page" className="truncate font-semibold text-slate-700">{part.label}</span>}
    </span>)}
  </nav>;
}
