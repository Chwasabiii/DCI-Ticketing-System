"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ChevronDown, MapPin, Search, Users } from "lucide-react";
import { createProject, setProjectApprovers, updateProjectStatus } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import type { Profile, Project, ProjectStatus } from "@/lib/types";

const statuses: ProjectStatus[] = ["planned", "ongoing", "completed"];

export function ProjectManagement({
  projects,
  people
}: {
  projects: Project[];
  people: Profile[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [updatingApproverProjectId, setUpdatingApproverProjectId] = useState<string | null>(null);
  const [openApproverProjectId, setOpenApproverProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const filteredProjects = projects.filter((project) => {
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const search = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [project.name, project.project_code, project.location]
        .some((field) => field?.toLowerCase().includes(search));
    return matchesStatus && matchesSearch;
  });

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

  async function handleApproverUpdate(
    event: FormEvent<HTMLFormElement>,
    projectId: string
  ) {
    event.preventDefault();
    if (updatingApproverProjectId) return;

    setUpdatingApproverProjectId(projectId);
    setError(null);
    setMessage(null);
    try {
      const result = await setProjectApprovers(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Project approvers saved.");
      router.refresh();
    } catch {
      setError("Project approvers could not be saved. Please try again.");
    } finally {
      setUpdatingApproverProjectId(null);
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

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">PROJECTS</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-navy">Project directory</h2>
            <p className="mt-1 text-sm text-slate-600">
              {projects.length} {projects.length === 1 ? "project" : "projects"} · Manage status and approval contacts.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-64">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, code, location"
                className="min-h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm focus-ring"
              />
            </label>
            <label>
              <span className="sr-only">Filter projects by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | ProjectStatus)}
                className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus-ring sm:w-40"
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-accent">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold text-navy">Your project directory is empty</h3>
            <p className="mt-1 text-sm text-slate-600">Add a project above to get started.</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
            <h3 className="font-semibold text-navy">No matching projects</h3>
            <p className="mt-1 text-sm text-slate-600">Try a different search or status filter.</p>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {filteredProjects.map((project) => {
              const pm = people.find((person) => person.id === project.pm_user_id);
              const projectApprovers = people.filter((person) =>
                project.approver_ids?.includes(person.id)
              );
              const hasApprover = Boolean(pm || projectApprovers.length);

              return (
                <article
                  key={project.id}
                  className="relative overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-soft"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="relative z-20 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {project.project_code && (
                            <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">
                              {project.project_code}
                            </span>
                          )}
                          <Badge value={project.status} />
                        </div>
                        <h3 className="mt-3 break-words text-lg font-bold text-navy">{project.name}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {project.location || "Location not set"}
                        </p>
                      </div>
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-accent">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project PM</p>
                        <p className="mt-1 truncate text-sm font-medium text-slate-800">
                          {pm?.full_name ?? pm?.email ?? "Not assigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Other approvers
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {projectApprovers.length
                            ? projectApprovers.map((person) => person.full_name ?? person.email).join(", ")
                            : "None assigned"}
                        </p>
                      </div>
                    </div>

                    {!hasApprover && (
                      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Assign an active PM or approver before this project can receive tickets.
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <form
                        onSubmit={(event) => handleStatusUpdate(event, String(project.id))}
                        className="flex items-end gap-2"
                      >
                        <input type="hidden" name="project_id" value={project.id} />
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-slate-500">Project status</span>
                          <select
                            key={`${project.id}-${project.status}`}
                            name="status"
                            defaultValue={project.status}
                            disabled={updatingProjectId !== null}
                            className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus-ring"
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          disabled={updatingProjectId !== null}
                          className="focus-ring min-h-9 rounded-md bg-navy px-3 text-xs font-semibold text-white hover:bg-[#163b68] disabled:opacity-60"
                        >
                          {updatingProjectId === String(project.id) ? "Saving..." : "Save"}
                        </button>
                      </form>

                      <div className="min-w-0">
                        <button
                          type="button"
                          aria-expanded={openApproverProjectId === String(project.id)}
                          aria-controls={`approvers-${project.id}`}
                          onClick={() => setOpenApproverProjectId((current) => current === String(project.id) ? null : String(project.id))}
                          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/60 focus-ring"
                        >
                          Manage approvers
                          <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-200 ${openApproverProjectId === String(project.id) ? "rotate-180" : ""}`} />
                        </button>
                        <div
                          id={`approvers-${project.id}`}
                          aria-hidden={openApproverProjectId !== String(project.id)}
                          inert={openApproverProjectId !== String(project.id)}
                          className={`absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-3rem))] origin-top-right transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${openApproverProjectId === String(project.id) ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-[0.98] opacity-0"}`}
                        >
                          <form
                            onSubmit={(event) => handleApproverUpdate(event, String(project.id))}
                            className="grid max-h-[min(70vh,32rem)] gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15"
                          >
                            <input type="hidden" name="project_id" value={project.id} />
                            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                              Project PM
                              <select
                                name="pm_user_id"
                                defaultValue={project.pm_user_id ?? ""}
                                disabled={updatingApproverProjectId !== null}
                                className="min-h-9 rounded-md border border-slate-200 px-2 text-sm font-normal focus-ring"
                              >
                                <option value="">No PM</option>
                                {people.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    {person.full_name ?? person.email ?? person.id}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <fieldset className="grid gap-1.5">
                              <legend className="text-xs font-semibold text-slate-700">Other approvers</legend>
                              <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 p-2">
                                {people.length === 0 ? (
                                  <p className="text-xs text-slate-500">No active accounts available.</p>
                                ) : (
                                  people.map((person) => (
                                    <label key={person.id} className="flex items-center gap-2 py-1.5 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        name="approvers"
                                        value={person.id}
                                        defaultChecked={project.approver_ids?.includes(person.id)}
                                        disabled={updatingApproverProjectId !== null}
                                        className="rounded border-slate-300 text-accent focus:ring-accent"
                                      />
                                      <span>{person.full_name ?? person.email ?? person.id}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                            </fieldset>
                            <button
                              type="submit"
                              disabled={updatingApproverProjectId !== null}
                              className="focus-ring min-h-9 rounded-md bg-navy px-3 text-xs font-semibold text-white hover:bg-[#163b68] disabled:opacity-60"
                            >
                              {updatingApproverProjectId === String(project.id) ? "Saving..." : "Save approvers"}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
