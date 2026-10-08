import { redirect } from "next/navigation";
import { SimpleTable } from "@/components/admin/simple-table";
import { getCurrentContext, getDisciplines } from "@/lib/data";

export default async function DisciplinesPage() {
  const [{ profile }, disciplines] = await Promise.all([
    getCurrentContext(),
    getDisciplines()
  ]);
  if (profile?.user_side !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl">
      <SimpleTable
        title="Discipline Management"
        rows={disciplines.map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
          lead_user_id: discipline.lead_user_id
        }))}
        columns={["name", "lead_user_id"]}
      />
    </div>
  );
}
