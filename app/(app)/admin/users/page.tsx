import { redirect } from "next/navigation";
import { SimpleTable } from "@/components/admin/simple-table";
import { getCurrentContext, getProfiles } from "@/lib/data";

export default async function UsersPage() {
  const [{ profile }, users] = await Promise.all([getCurrentContext(), getProfiles()]);
  if (profile?.user_side !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl">
      <SimpleTable
        title="User Management"
        rows={users.map((user) => ({
          id: user.id,
          name: user.full_name ?? user.email,
          email: user.email,
          user_side: user.user_side,
          status: user.status
        }))}
        columns={["name", "email", "user_side", "status"]}
      />
    </div>
  );
}
