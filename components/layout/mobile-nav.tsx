import Link from "next/link";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FileBarChart,
  Home,
  Inbox,
  LogOut,
  PlusCircle,
  Settings,
  Shield,
  Users,
  Workflow
} from "lucide-react";
import type { NavIcon, NavItem } from "@/lib/navigation";

const icons: Record<NavIcon, typeof Home> = {
  "bar-chart": BarChart3,
  bell: Bell,
  clipboard: ClipboardList,
  "file-chart": FileBarChart,
  home: Home,
  inbox: Inbox,
  logout: LogOut,
  plus: PlusCircle,
  settings: Settings,
  shield: Shield,
  users: Users,
  workflow: Workflow
};

export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white p-2 shadow-soft md:hidden">
      {items.slice(0, 4).map((item) => {
        const Icon = icons[item.icon];

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
