import type { EmployeeRole, UserSide } from "@/lib/types";

export type NavIcon =
  | "bar-chart"
  | "bell"
  | "clipboard"
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
  roles: EmployeeRole[] = []
): NavItem[] {
  if (userSide === "client") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "My Tickets", href: "/tickets", icon: "clipboard" },
      { label: "FAQs", href: "/faqs", icon: "clipboard" },
      { label: "Approvals", href: "/approvals", icon: "shield" },
      { label: "Open a Ticket", href: "/tickets/new", icon: "plus" }
    ];
  }

  if (userSide === "admin") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Incoming Queue", href: "/queue", icon: "inbox" },
      { label: "FAQs", href: "/faqs", icon: "clipboard" },
      { label: "Approvals", href: "/approvals", icon: "shield" },
      { label: "All Tickets", href: "/tickets", icon: "clipboard" },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Manage FAQs", href: "/admin/faqs", icon: "clipboard" },
      { label: "Projects", href: "/admin/projects", icon: "clipboard" },
      { label: "Departments", href: "/admin/departments", icon: "workflow" },
      { label: "Disciplines", href: "/admin/disciplines", icon: "shield" },
      { label: "Categories", href: "/admin/categories", icon: "clipboard" }
    ];
  }

  const items: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: "home" },
    { label: "FAQs", href: "/faqs", icon: "clipboard" },
    { label: "Approvals", href: "/approvals", icon: "shield" },
    { label: "Open a Ticket", href: "/tickets/new", icon: "plus" }
  ];

  if (roles.includes("Coordinator")) {
    items.push({ label: "Incoming Queue", href: "/queue", icon: "inbox" });
  }

  if (roles.includes("Discipline Lead")) {
    items.push({ label: "Discipline Tickets", href: "/discipline", icon: "workflow" });
    items.push({ label: "Workload", href: "/workload", icon: "bar-chart" });
  }

  if (roles.includes("Personnel")) {
    items.push({ label: "Assigned Tickets", href: "/assigned", icon: "clipboard" });
  }

  if (roles.includes("Manager")) {
    items.push({ label: "Reports", href: "/reports", icon: "file-chart" });
    items.push({ label: "Overdue", href: "/overdue", icon: "bell" });
  }

  return items;
}
