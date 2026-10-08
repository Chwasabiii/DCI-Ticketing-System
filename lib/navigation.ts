import type { EmployeeRole, UserSide } from "@/lib/types";

export type NavIcon =
  | "bar-chart"
  | "bell"
  | "clipboard"
  | "file-chart"
  | "home"
  | "inbox"
  | "logout"
  | "plus"
  | "settings"
  | "shield"
  | "users"
  | "workflow";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

export function getNavItems(
  userSide?: UserSide,
  roles: EmployeeRole[] = []
): NavItem[] {
  if (userSide === "client") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "My Tickets", href: "/tickets", icon: "clipboard" },
      { label: "Submit a Ticket", href: "/tickets/new", icon: "plus" },
      { label: "Notifications", href: "/notifications", icon: "bell" },
      { label: "Settings", href: "/settings", icon: "settings" },
      { label: "Logout", href: "/logout", icon: "logout" }
    ];
  }

  if (userSide === "admin") {
    return [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Departments", href: "/admin/departments", icon: "workflow" },
      { label: "Disciplines", href: "/admin/disciplines", icon: "shield" },
      { label: "Categories", href: "/admin/categories", icon: "clipboard" },
      { label: "Settings", href: "/settings", icon: "settings" },
      { label: "Logout", href: "/logout", icon: "logout" }
    ];
  }

  const items: NavItem[] = [{ label: "Dashboard", href: "/dashboard", icon: "home" }];

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

  items.push({ label: "Settings", href: "/settings", icon: "settings" });
  items.push({ label: "Logout", href: "/logout", icon: "logout" });

  return items;
}
