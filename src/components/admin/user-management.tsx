"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, UserCheck, UserX, X, ShieldCheck, LoaderCircle } from "lucide-react";
import { deactivateUser, reactivateUser, resendUserInvitation, updateManagedUser } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import type { EmployeeRole, ManagedProfile, ServiceTeam, UserSide } from "@/lib/types";

type RoleOption = { id: number; name: EmployeeRole };
type ManagementResult = { success?: string; error?: string };

export function UserManagement({
  users,
  roles,
  teams,
  currentUserId
}: {
  users: ManagedProfile[];
  roles: RoleOption[];
  teams: ServiceTeam[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ManagedProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editDialogRef = useRef<HTMLDivElement>(null);
  const activeCount = users.filter((user) => (user.status ?? "active") === "active").length;
  const inactiveCount = users.length - activeCount;
  const hasFilters = search || sideFilter !== "all" || statusFilter !== "active" || roleFilter !== "all";

  useEffect(() => {
    if (!editing) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => editDialogRef.current?.querySelector<HTMLElement>("select")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editDialogRef.current?.querySelector('[aria-label="Close dialog"]:disabled')) setEditing(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [editing]);

  function trapEditDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !editDialogRef.current) return;
    const focusable = Array.from(editDialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled)"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function clearFilters() {
    setSearch("");
    setSideFilter("all");
    setStatusFilter("all");
    setRoleFilter("all");
    setPage(1);
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query || [user.full_name, user.email, user.id, ...user.employee_roles]
        .some((value) => value?.toLocaleLowerCase().includes(query));
      const matchesSide = sideFilter === "all" || user.user_side === sideFilter;
      const matchesStatus = statusFilter === "all" || (user.status ?? "active") === statusFilter;
      const matchesRole = roleFilter === "all" || user.employee_roles.includes(roleFilter as EmployeeRole);
      return matchesQuery && matchesSide && matchesStatus && matchesRole;
    });
  }, [users, search, sideFilter, statusFilter, roleFilter]);
  const sortedUsers = useMemo(() => [...filteredUsers].sort((a, b) => {
    if (sortBy === "status") return String(a.status ?? "active").localeCompare(String(b.status ?? "active"));
    if (sortBy === "type") return a.user_side.localeCompare(b.user_side);
    return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", undefined, { sensitivity: "base" });
  }), [filteredUsers, sortBy]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function performAction(userId: string, action: (formData: FormData) => Promise<ManagementResult>, formData: FormData) {
    setBusyId(userId);
    setError(null);
    setNotice(null);
    try {
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setNotice(result.success ?? "Account updated.");
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("The account could not be updated. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, userId: string, side: UserSide) {
    event.preventDefault();
    const form = event.currentTarget;
    if (side === "admin" && editing?.user_side !== "admin" && !await confirm({ title: "Grant administrator access?", description: "Administrators can manage all accounts and system settings.", confirmLabel: "Grant access" })) return;
    await performAction(userId, updateManagedUser, new FormData(form));
  }

  async function handleStatus(user: ManagedProfile) {
    const isActive = (user.status ?? "active") === "active";
    const prompt = isActive
      ? `Deactivate ${user.full_name ?? user.email ?? "this account"}? They will lose access to the system.`
      : `Restore access for ${user.full_name ?? user.email ?? "this account"}?`;
    if (!await confirm({ title: isActive ? "Deactivate this account?" : "Restore this account?", description: prompt, confirmLabel: isActive ? "Deactivate account" : "Restore access", danger: isActive })) return;
    const formData = new FormData();
    formData.set("user_id", user.id);
    await performAction(user.id, isActive ? deactivateUser : reactivateUser, formData);
  }

  async function handleResendInvitation(user: ManagedProfile) {
    if (!await confirm({
      title: "Resend invitation?",
      description: `Send a new invitation to ${user.email ?? "this user"}?`,
      confirmLabel: "Resend invitation"
    })) return;

    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      const result = await resendUserInvitation(user.id);
      if (result.error) setError(result.error);
      else {
        setNotice(result.success ?? "Invitation resent.");
        router.refresh();
      }
    } catch {
      setError("The invitation could not be resent. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total accounts", count: users.length, icon: Users, tone: "bg-blue-50 text-blue-700" },
          { label: "Active", count: activeCount, icon: UserCheck, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Deactivated", count: inactiveCount, icon: UserX, tone: "bg-slate-100 text-slate-600" }
        ].map(({ label, count, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] transition-shadow hover:shadow-soft">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
            <span><span className="block text-2xl font-bold leading-none text-navy">{count}</span><span className="mt-1 block text-xs font-medium text-slate-500">{label}</span></span>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">Accounts</h2>
            <p className="mt-1 text-sm text-slate-600">Showing <span className="font-semibold text-navy">{filteredUsers.length}</span> of {users.length}</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-5">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Search accounts
              <span className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name, email, or role" className="min-h-10 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm font-normal text-slate-800 transition-shadow focus-ring" /></span>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Account type
              <select value={sideFilter} onChange={(event) => { setSideFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 transition-shadow focus-ring">
                <option value="all">All types</option>
                <option value="client">Employee</option>
                <option value="employee">Service provider</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Status
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 transition-shadow focus-ring">
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
                <option value="all">All statuses</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Service provider role
              <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 transition-shadow focus-ring">
                <option value="all">All roles</option>
                {roles.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">Sort by<select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 focus-ring"><option value="name">Name</option><option value="type">Account type</option><option value="status">Status</option></select></label>
          </div>
        </div>
        {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-accent hover:text-blue-800"><X className="h-3.5 w-3.5" /> Clear filters</button>}
        {error && <div className="mt-4"><FeedbackMessage type="error">{error}</FeedbackMessage></div>}
        {notice && <div className="mt-4"><FeedbackMessage type="success">{notice}</FeedbackMessage></div>}
      </div>

      <div className="divide-y divide-slate-100 sm:hidden">
        {visibleUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const isActive = (user.status ?? "active") === "active";
          return <article key={user.id} className="animate-enter p-4 transition-colors hover:bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-semibold text-navy">{user.full_name ?? "Name not set"}{isSelf && <span className="ml-2 text-xs font-normal text-slate-500">You</span>}</p><p className="truncate text-xs text-slate-500">{user.email ?? "No email"}</p></div>
              <Badge value={isActive ? "active" : "inactive"} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Badge value={accountTypeLabel(user.user_side)} />{user.service_team && <Badge value={user.service_team.name} className="normal-case tracking-normal" />}{user.employee_roles.map((role) => <Badge key={role} value={role} className="normal-case tracking-normal" />)}{user.invitation_pending && <span className="text-xs font-medium text-amber-700">Invitation pending</span>}</div>
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
              {!isSelf && <button type="button" onClick={() => { setEditing(user); setError(null); setNotice(null); }} disabled={busyId === user.id} className="min-h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50">Edit account</button>}
              <button type="button" onClick={() => void handleStatus(user)} disabled={isSelf || busyId === user.id} className="min-h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50">{busyId === user.id ? <span className="inline-flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Saving…</span> : isActive ? "Deactivate" : "Restore access"}</button>
            </div>
            {isSelf && <p className="mt-2 text-xs text-slate-500">Your admin access is protected.</p>}
          </article>;
        })}
        {filteredUsers.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No accounts match these filters.</p>}
      </div>
      <div role="region" tabIndex={0} className="hidden overscroll-x-contain overflow-x-auto sm:block" aria-label="User accounts; swipe horizontally to see all columns">
        <table className="min-w-[720px] w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name / Email</th>
              <th className="px-4 py-3">Account type</th>
              <th className="px-4 py-3">Service team / roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 && (
              <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No accounts match these filters.</td></tr>
            )}
            {visibleUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const isActive = (user.status ?? "active") === "active";
              return (
                <tr key={user.id} className="animate-enter align-top transition-colors hover:bg-slate-50/70">
                  <td className="max-w-64 px-4 py-4">
                    <p className="truncate font-semibold text-slate-800">{user.full_name ?? "Name not set"}{isSelf && <span className="ml-2 text-xs font-normal text-slate-500">You</span>}</p>
                    <p className="truncate text-xs text-slate-500">{user.email ?? "No email"}</p>
                    {user.invitation_pending && <p className="mt-1 text-xs font-medium text-amber-700">Invitation pending</p>}
                  </td>
                  <td className="px-4 py-4"><Badge value={accountTypeLabel(user.user_side)} /></td>
                  <td className="px-4 py-4">
                    {user.employee_roles.length || user.service_team ? (
                      <div className="flex max-w-sm flex-wrap gap-1.5">
                        {user.service_team && <Badge value={user.service_team.name} className="normal-case tracking-normal" />}
                        {user.employee_roles.map((role) => <Badge key={role} value={role} className="normal-case tracking-normal" />)}
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-4"><Badge value={isActive ? "active" : "inactive"} /></td>
                  <td className="min-w-44 px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {user.invitation_pending && isActive && (
                        <button type="button" onClick={() => void handleResendInvitation(user)} disabled={busyId === user.id} className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {busyId === user.id ? "Sending..." : "Resend invite"}
                        </button>
                      )}
                      {!isSelf && (
                        <button type="button" onClick={() => { setEditing(user); setError(null); setNotice(null); }} disabled={busyId === user.id} className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          Edit
                        </button>
                      )}
                      <button type="button" onClick={() => void handleStatus(user)} disabled={isSelf || busyId === user.id} className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        {busyId === user.id ? <span className="inline-flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Saving…</span> : isActive ? "Deactivate" : "Restore access"}
                      </button>
                    </div>
                    {isSelf && <p className="mt-1 text-xs text-slate-500">Your admin access is protected.</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sortedUsers.length > pageSize && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="text-xs text-slate-500">Page {currentPage} of {pageCount}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next</button></div></div>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setEditing(null); }}>
        <div ref={editDialogRef} onKeyDown={trapEditDialogFocus} role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="animate-modal-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <EditManagedUserForm
          key={editing.id}
          user={editing}
          roles={roles}
          teams={teams}
          saving={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSubmit={handleEdit}
        />
        </div>
        </div>
      )}
      {confirmDialog}
      </div>
    </section>
  );
}

function EditManagedUserForm({
  user,
  roles,
  teams,
  saving,
  onClose,
  onSubmit
}: {
  user: ManagedProfile;
  roles: RoleOption[];
  teams: ServiceTeam[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, userId: string, side: UserSide) => void;
}) {
  const [side, setSide] = useState<UserSide>(user.user_side);
  const [teamId, setTeamId] = useState(String(user.service_team_id ?? teams.find((team) => team.slug === "it-support")?.id ?? ""));
  const [selectedRoles, setSelectedRoles] = useState<number[]>(
    roles.filter((role) => user.employee_roles.includes(role.name)).map((role) => role.id)
  );

  function toggleRole(roleId: number) {
    setSelectedRoles((current) => current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId]);
  }

  return (
    <div className="p-5 sm:p-6">
      <form onSubmit={(event) => void onSubmit(event, user.id, side)} className="grid gap-5">
        <input type="hidden" name="user_id" value={user.id} />
        <div>
          <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><ShieldCheck className="h-5 w-5" /></span><span><h3 id="edit-user-title" className="text-lg font-bold text-navy">Edit account</h3><p className="mt-1 text-sm text-slate-600">Change access, service team, and provider responsibilities.</p></span></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close dialog" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{user.full_name ?? user.email ?? "Account"}</p>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Account type
          <select name="user_side" value={side} onChange={(event) => setSide(event.target.value as UserSide)} disabled={saving} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring">
            <option value="client">Employee</option>
            <option value="employee">Service provider</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {side === "employee" && (
          <>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Service team
            <select name="service_team_id" value={teamId} onChange={(event) => setTeamId(event.target.value)} required disabled={saving} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring">
              <option value="">Select a team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Service provider roles</legend>
            {roles.length === 0 ? <p className="text-sm text-amber-800">No service provider roles are configured.</p> : (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {roles.map((role) => (
                <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 px-3 py-3 text-sm text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/50">
                    <input type="checkbox" name="role_ids" value={role.id} checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} disabled={saving} className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />
                    {role.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          </>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0">
          <button type="button" onClick={onClose} disabled={saving} className="focus-ring min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">Cancel</button>
          <button type="submit" disabled={saving || (side === "employee" && selectedRoles.length === 0)} className="focus-ring min-h-11 rounded-xl bg-navy px-5 text-sm font-semibold text-white transition-colors hover:bg-[#163b68] disabled:cursor-wait disabled:opacity-60">{saving ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Saving…</span> : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

function accountTypeLabel(side: UserSide) {
  if (side === "client") return "Employee";
  if (side === "employee") return "Service provider";
  return "Admin";
}
