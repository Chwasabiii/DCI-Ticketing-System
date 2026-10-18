import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { UserManagement } from "@/components/admin/user-management";
import { getAssignableRoles, getCurrentContext, getManagedProfiles } from "@/lib/data";

export default async function UsersPage() {
  const [{ profile }, users, roles] = await Promise.all([
    getCurrentContext(),
    getManagedProfiles(),
    getAssignableRoles()
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">User Management</h1>
        <p className="mt-2 text-sm text-slate-600">Invite clients and employees to create accounts.</p>
      </header>
      <InviteUserForm roles={roles} />
      <UserManagement users={users} roles={roles} currentUserId={profile.id} />
    </div>
  );
}
