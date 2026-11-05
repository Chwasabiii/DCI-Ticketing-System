import type { EmployeeRole, UserSide } from "@/lib/types";

export type NavIcon =
  | "bar-chart"
  | "bell"
  | "clipboard"
  | "clock"
  | "file-chart"
  | "home"
  | "inbox"
  | "plus"
  | "shield"
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
      { label: "Cost Control Group", href: "/cost-control", icon: "clipboard" },
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Open a Ticket", href: "/tickets/new", icon: "plus" },
      { label: "My Tickets", href: "/tickets", icon: "clipboard" },
      { label: "FAQs", href: "/faqs", icon: "clipboard" },
    ];
  }

  if (userSide === "admin") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Triage Inbox", href: "/inbox", icon: "inbox" },
      { label: "FAQs", href: "/faqs", icon: "clipboard" },
      { label: "All Tickets", href: "/tickets", icon: "clipboard" },
      { label: "SLA Targets", href: "/admin/sla", icon: "clock" },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Manage FAQs", href: "/admin/faqs", icon: "clipboard" },
    ];
  }

  const items: NavItem[] = [
    { label: serviceTeamSlug === "cost-control" ? "CCG Dashboard" : "IT Support Dashboard", href: "/dashboard", icon: "home" },
    { label: "Triage Inbox", href: "/inbox", icon: "inbox" },
    { label: "FAQs", href: "/faqs", icon: "clipboard" }
  ];

  if (roles.includes("Coordinator")) items.push({ label: "Workload", href: "/workload", icon: "bar-chart" });

  if (roles.includes("Manager")) {
    items.push({ label: "Reports", href: "/reports", icon: "file-chart" });
  }

  if (serviceTeamSlug === "it-support" || serviceTeamSlug === "cost-control") {
    items.push({ label: "Manage FAQs", href: "/admin/faqs", icon: "clipboard" });
  }

  return items;
}
