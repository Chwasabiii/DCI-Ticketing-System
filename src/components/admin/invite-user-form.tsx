"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { inviteUser } from "@/lib/actions";
import type { EmployeeRole } from "@/lib/types";

export function InviteUserForm({
  roles
}: {
  roles: Array<{ id: number; name: EmployeeRole }>;
}) {
  const [userSide, setUserSide] = useState<"client" | "employee">("client");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await inviteUser(new FormData(form));
      if ("error" in result) {
        setError(result.error ?? "The invitation could not be sent.");
      } else {
        setMessage(result.success);
        form.reset();
        setUserSide("client");
      }
    } catch {
      setError("The invitation could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-soft">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-navy">Invite a user</h2>
        <p className="mt-1 text-sm text-slate-600">
          The user will receive an email invitation to set up their account.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Full name</span>
          <input
            name="full_name"
            required
            disabled={submitting}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            autoComplete="name"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Email address</span>
          <input
            name="email"
            type="email"
            required
            disabled={submitting}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            autoComplete="email"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Account type</span>
          <select
            name="user_side"
            value={userSide}
            disabled={submitting}
            onChange={(event) => setUserSide(event.target.value as "client" | "employee")}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          >
            <option value="client">Client</option>
            <option value="employee">Employee</option>
          </select>
        </label>
        {userSide === "employee" && (
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-sm font-semibold text-slate-700">Employee roles</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="roles"
                    value={role.name}
                    disabled={submitting}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p>}
        {message && <p role="status" className="text-sm text-resolved md:col-span-2">{message}</p>}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:cursor-wait disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Sending invitation..." : "Send invitation"}
          </button>
        </div>
      </form>
    </section>
  );
}