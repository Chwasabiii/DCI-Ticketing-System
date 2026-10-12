import { redirect } from "next/navigation";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { SimpleTable } from "@/components/admin/simple-table";
import { getAssignableRoles, getCurrentContext, getProfiles } from "@/lib/data";
import { reactivateUser } from "@/lib/actions";

export default async function UsersPage() {
  const [{ profile }, users, roles] = await Promise.all([
    getCurrentContext(),
    getProfiles(),
    getAssignableRoles()
  ]);
  if (profile?.user_side !== "admin" || profile.status !== "active") redirect("/dashboard");
  const archivedUsers = users.filter((user) => user.status === "inactive");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-navy">User Management</h1>
        <p className="mt-2 text-sm text-slate-600">Invite clients and employees to create accounts.</p>
      </header>
      <InviteUserForm roles={roles} />
      <SimpleTable
        title="Accounts"
        rows={users.map((user) => ({
          id: user.id,
          name: user.full_name ?? user.email,
          email: user.email,
          user_side: user.user_side,
          status: user.status
        }))}
        columns={["name", "email", "user_side", "status"]}
      />
      {archivedUsers.length > 0 && (
        <section className="rounded-lg bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold text-navy">Archived accounts</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {archivedUsers.map((archivedUser) => (
              <li key={archivedUser.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {archivedUser.full_name ?? archivedUser.email}
                  </p>
                  <p className="truncate text-xs text-slate-500">{archivedUser.email}</p>
                </div>
                <form action={reactivateUser}>
                  <input type="hidden" name="user_id" value={archivedUser.id} />
                  <button
                    type="submit"
                    className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Restore access
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
