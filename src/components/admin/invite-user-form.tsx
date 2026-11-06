"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { inviteUser } from "@/lib/actions";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Button } from "@/components/ui/button";
import type { EmployeeRole, ServiceTeam, UserSide } from "@/lib/types";

export function InviteUserForm({
  roles,
  teams
}: {
  roles: Array<{ id: number; name: EmployeeRole }>;
  teams: ServiceTeam[];
}) {
  const [userSide, setUserSide] = useState<UserSide>("client");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    if (userSide === "employee" && new FormData(form).getAll("roles").length === 0) {
      setError("Select a team and at least one service provider role.");
      return;
    }
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
        <p className="mt-2 text-xs text-slate-500"><span className="font-bold text-urgent">*</span> Required fields</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Full name <span className="text-urgent" aria-hidden="true">*</span><span className="sr-only">required</span></span>
          <input
            name="full_name"
            required
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm focus-ring"
            autoComplete="name"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Email address <span className="text-urgent" aria-hidden="true">*</span><span className="sr-only">required</span></span>
          <input
            name="email"
            type="email"
            required
            disabled={submitting}
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm focus-ring"
            autoComplete="email"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Account type <span className="text-urgent" aria-hidden="true">*</span><span className="sr-only">required</span></span>
          <select
            name="user_side"
            required
            value={userSide}
            disabled={submitting}
            onChange={(event) => setUserSide(event.target.value as UserSide)}
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm focus-ring"
          >
            <option value="client">Employee</option>
            <option value="employee">Service provider</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {userSide === "employee" && (
          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Service team <span className="text-urgent" aria-hidden="true">*</span></span>
            <select name="service_team_id" required disabled={submitting} defaultValue={teams.find((team) => team.slug === "it-support")?.id ?? ""} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus-ring">
              <option value="" disabled>Select a service team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.is_in_scope ? " · In scope" : " · Future team"}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-2 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Service provider roles <span className="text-urgent" aria-hidden="true">*</span><span className="sr-only">required</span></legend>
            <p className="text-xs text-slate-500">Select at least one role for this service provider.</p>
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
          </div>
        )}
        {error && <div className="md:col-span-2"><FeedbackMessage type="error">{error}</FeedbackMessage></div>}
        {message && <div className="md:col-span-2"><FeedbackMessage type="success">{message}</FeedbackMessage></div>}
        <div className="md:col-span-2">
          <Button type="submit" loading={submitting} className="bg-navy hover:bg-[#163b68]">
            <Send className="h-4 w-4" />
            {submitting ? "Sending invitation..." : "Send invitation"}
          </Button>
        </div>
      </form>
    </section>
  );
}
