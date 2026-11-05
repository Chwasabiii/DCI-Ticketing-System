import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { UserManagement } from "@/components/admin/user-management";
import { getAssignableRoles, getCurrentContext, getManagedProfiles, getServiceTeams } from "@/lib/data";

export default async function UsersPage() {
  const [{ profile }, users, roles, teams] = await Promise.all([
    getCurrentContext(),
    getManagedProfiles(),
    getAssignableRoles(),
    getServiceTeams()
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">User Management</h1>
        <p className="mt-2 text-sm text-slate-600">Invite end users and service providers, then assign providers to a service team.</p>
      </header>
      <InviteUserForm roles={roles} teams={teams} />
      <UserManagement users={users} roles={roles} teams={teams} currentUserId={profile.id} />
    </div>
  );
}
