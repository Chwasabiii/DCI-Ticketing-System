"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createProject, updateProjectStatus } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import type { Project, ProjectStatus } from "@/lib/types";

const statuses: ProjectStatus[] = ["planned", "ongoing", "completed"];

export function ProjectManagement({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createProject(new FormData(form));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Project added.");
      form.reset();
      router.refresh();
    } catch {
      setError("The project could not be added. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusUpdate(
    event: FormEvent<HTMLFormElement>,
    projectId: string
  ) {
    event.preventDefault();
    if (updatingProjectId) return;

    setUpdatingProjectId(projectId);
    setError(null);
    setMessage(null);
    try {
      const result = await updateProjectStatus(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Project status updated.");
      router.refresh();
    } catch {
      setError("The project status could not be updated. Please try again.");
    } finally {
      setUpdatingProjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-soft">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-navy">Add a project</h2>
          <p className="mt-1 text-sm text-slate-600">
            Planned and ongoing projects are available when submitting a PMSG ticket.
          </p>
        </div>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Project name</span>
            <input
              name="name"
              required
              maxLength={200}
              disabled={submitting}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Project code</span>
            <input
              name="project_code"
              maxLength={100}
              disabled={submitting}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Location</span>
            <input
              name="location"
              maxLength={200}
              disabled={submitting}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select
              name="status"
              defaultValue="planned"
              disabled={submitting}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
            >
              <option value="planned">Planned</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring min-h-10 rounded-md bg-navy px-4 text-sm font-semibold text-white hover:bg-[#163b68] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Adding project..." : "Add project"}
            </button>
          </div>
        </form>
      </section>

      {(error || message) && (
        <p
          role={error ? "alert" : "status"}
          className={`text-sm ${error ? "text-red-700" : "text-resolved"}`}
        >
          {error ?? message}
        </p>
      )}

      <section className="rounded-lg bg-white shadow-soft">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-navy">Project directory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    No projects found.
                  </td>
                </tr>
              )}
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-4 font-medium text-slate-800">{project.name}</td>
                  <td className="px-4 py-4 text-slate-700">{project.project_code || "Not set"}</td>
                  <td className="px-4 py-4 text-slate-700">{project.location || "Not set"}</td>
                  <td className="px-4 py-4"><Badge value={project.status} /></td>
                  <td className="px-4 py-4">
                    <form
                      onSubmit={(event) => handleStatusUpdate(event, String(project.id))}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="project_id" value={project.id} />
                      <select
                        key={`${project.id}-${project.status}`}
                        name="status"
                        defaultValue={project.status}
                        disabled={updatingProjectId !== null}
                        className="min-h-9 rounded-md border border-slate-200 px-2 text-sm focus-ring"
                        aria-label={`Status for ${project.name}`}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={updatingProjectId !== null}
                        className="focus-ring min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {updatingProjectId === String(project.id) ? "Saving..." : "Save"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
