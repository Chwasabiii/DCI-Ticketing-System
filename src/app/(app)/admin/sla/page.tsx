import { redirect } from "next/navigation";
import { SlaManagement } from "@/components/admin/sla-management";
import { getCurrentContext, getTicketSlaHolidays, getTicketSlaPolicies } from "@/lib/data";

export default async function SlaSettingsPage() {
  const [{ profile }, policies, holidays] = await Promise.all([
    getCurrentContext(),
    getTicketSlaPolicies(),
    getTicketSlaHolidays()
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");
  return <SlaManagement policies={policies} holidays={holidays} />;
}
