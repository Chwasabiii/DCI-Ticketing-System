import { redirect } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentContext } from "@/lib/data";
import { getNavItems } from "@/lib/navigation";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { profile, roleNames } = await getCurrentContext();

  if (!profile) redirect("/login");

  const items = getNavItems(profile.user_side, roleNames);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} roles={roleNames} />
        <main className="flex-1 px-4 py-6 pb-24 lg:px-8">{children}</main>
        <MobileNav items={items} />
      </div>
    </div>
  );
}
