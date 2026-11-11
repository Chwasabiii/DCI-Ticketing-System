import type { EmployeeRole, UserSide } from "@/lib/types";

export type NavIcon =
  | "bar-chart"
  | "bell"
  | "book"
  | "calculator"
  | "clock"
  | "file-chart"
  | "gauge"
  | "home"
  | "help"
  | "inbox"
  | "plus"
  | "shield"
  | "ticket"
  | "users"
  | "workflow";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

export function isNavItemActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const normalizedHref = href.replace(/\/+$/, "") || "/";

  if (normalizedHref === "/dashboard" && normalizedPath === "/") return true;
  if (normalizedPath === normalizedHref) return true;
  if (normalizedHref === "/tickets" && normalizedPath === "/tickets/new") {
    return false;
  }

  return normalizedPath.startsWith(`${normalizedHref}/`);
}

export function getNavItems(
  userSide?: UserSide,
  roles: EmployeeRole[] = [],
  serviceTeamSlug?: string | null
): NavItem[] {
  if (userSide === "client") {
    return [
      { label: "IT Support", href: "/it-support", icon: "inbox" },
      { label: "Cost Control Group", href: "/cost-control", icon: "calculator" },
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "My Tickets", href: "/tickets", icon: "ticket" },
      { label: "FAQs", href: "/faqs", icon: "help" },
      { label: "Open a Ticket", href: "/tickets/new", icon: "plus" },
    ];
  }

  if (userSide === "admin") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Triage Inbox", href: "/inbox", icon: "inbox" },
      { label: "FAQs", href: "/faqs", icon: "help" },
      { label: "All Tickets", href: "/tickets", icon: "ticket" },
      { label: "RACI Matrix", href: "/raci", icon: "workflow" },
      { label: "SLA Targets", href: "/admin/sla", icon: "clock" },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Manage FAQs", href: "/admin/faqs", icon: "book" },
    ];
  }

  const items: NavItem[] = [
    { label: serviceTeamSlug === "cost-control" ? "CCG Dashboard" : serviceTeamSlug === "software-csr" ? "Software CSR Dashboard" : "IT Support Dashboard", href: "/dashboard", icon: "home" },
    { label: "Triage Inbox", href: "/inbox", icon: "inbox" },
    { label: "KPI Score", href: "/performance", icon: "bar-chart" },
    { label: "FAQs", href: "/faqs", icon: "help" },
    { label: "RACI Matrix", href: "/raci", icon: "workflow" }
  ];

  if (roles.includes("Coordinator")) items.push({ label: "Workload", href: "/workload", icon: "gauge" });

  if (roles.includes("Manager")) {
    items.push({ label: "Reports", href: "/reports", icon: "file-chart" });
  }

  if (["it-support", "cost-control", "software-csr"].includes(serviceTeamSlug ?? "")) {
    items.push({ label: "Manage FAQs", href: "/admin/faqs", icon: "book" });
  }

  return items;
}
