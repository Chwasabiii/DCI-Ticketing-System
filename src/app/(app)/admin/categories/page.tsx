import { redirect } from "next/navigation";
import { SimpleTable } from "@/components/admin/simple-table";
import { getCategories, getCurrentContext } from "@/lib/data";

export default async function CategoriesPage() {
  const [{ profile }, categories] = await Promise.all([
    getCurrentContext(),
    getCategories()
  ]);
  if (profile?.user_side !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl">
      <SimpleTable
        title="Category Management"
        rows={categories.map((category) => ({
          id: category.id,
          name: category.name,
          discipline_id: category.discipline_id
        }))}
        columns={["name", "discipline_id"]}
      />
    </div>
  );
}
