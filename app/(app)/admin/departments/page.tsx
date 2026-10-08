import { redirect } from "next/navigation";
import { SimpleTable } from "@/components/admin/simple-table";
import { getCurrentContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function DepartmentsPage() {
  const { profile } = await getCurrentContext();
  if (profile?.user_side !== "admin") redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase.from("departments").select("*").order("name");

  return (
    <div className="mx-auto max-w-7xl">
      <SimpleTable
        title="Department Management"
        rows={(data ?? []) as Record<string, string>[]}
        columns={["name", "status"]}
      />
    </div>
  );
}
