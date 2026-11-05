import { redirect } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { OnboardingTips } from "@/components/layout/onboarding-tips";
import { getCurrentContext, getNotifications, getUnreadNotificationCount } from "@/lib/data";
import { getNavItems } from "@/lib/navigation";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [{ profile, roleNames }, notifications, unreadNotificationCount] = await Promise.all([
    getCurrentContext(),
    getNotifications(5),
    getUnreadNotificationCount()
  ]);

  if (!profile) redirect("/login");
  if (profile.status === "inactive") redirect("/account-archived");

  const items = getNavItems(profile.user_side, roleNames, profile.service_team?.slug);

  return (
    <div className="flex min-h-screen bg-[#f4f6fa]">
      <a href="#main-content" className="focus-ring sr-only fixed left-4 top-4 z-50 rounded-lg bg-white px-4 py-3 font-semibold text-navy shadow-lg focus:not-sr-only">
        Skip to main content
      </a>
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar profile={profile} roles={roleNames} items={items} notifications={notifications} unreadNotificationCount={unreadNotificationCount} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 pb-24 focus:outline-none sm:px-6 lg:px-9 lg:py-8"><OnboardingTips userId={profile.id} side={profile.user_side} roles={roleNames} /><Breadcrumbs items={items} />{children}</main>
        <MobileNav items={items} />
      </div>
    </div>
  );
}
