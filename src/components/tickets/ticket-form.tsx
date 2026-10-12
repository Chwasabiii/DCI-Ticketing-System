"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTicket } from "@/lib/actions";
import {
  MAX_TICKET_ATTACHMENT_SIZE,
  MAX_TICKET_ATTACHMENTS,
  uploadTicketAttachments
} from "@/lib/attachments";
import type { Category, Department, Discipline, Priority, Project } from "@/lib/types";

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

function fileSizeLabel(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function TicketForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Priority>("medium");
  const [message, setMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      try {
        const response = await fetch("/api/reference-data", {
          credentials: "same-origin"
        });

        if (!response.ok) throw new Error("Could not load ticket options.");

        const data = (await response.json()) as {
          categories: Category[];
          disciplines: Discipline[];
          departments: Department[];
          projects: Project[];
        };

        if (!cancelled) {
          setCategories(data.categories);
          setDisciplines(data.disciplines);
          setDepartments(data.departments);
          setProjects(data.projects);
          setReferencesLoaded(true);
        }
      } catch {
        if (!cancelled) setReferenceError("Ticket options could not be loaded. You can still submit a general request.");
      }
    }

    void loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || createdTicketId) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await createTicket(new FormData(event.currentTarget));
      if ("error" in result) {
        setMessage(result.error ?? "The ticket could not be created.");
        return;
      }

      setCreatedTicketId(result.ticketId);
      const uploadResult = await uploadTicketAttachments(
        result.ticketId,
        result.userId,
        files
      );

      setUploadedFiles(uploadResult.uploaded);
      setFailedFiles(uploadResult.failed);
      if (uploadResult.error || uploadResult.failed.length > 0) {
        setMessage(
          `Ticket created, but attachments were not fully uploaded. ${
            uploadResult.error ?? `Could not upload: ${uploadResult.failed.join(", ")}.`
          }`
        );
        return;
      }

      router.push(`/tickets/${result.ticketId}`);
    } catch {
      setMessage("Could not submit your ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function addFiles(incomingFiles: File[]) {
    const oversizedFiles = incomingFiles.filter(
      (file) => file.size > MAX_TICKET_ATTACHMENT_SIZE
    );
    const existingKeys = new Set(
      files.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const newFiles = incomingFiles.filter(
      (file) =>
        file.size <= MAX_TICKET_ATTACHMENT_SIZE &&
        !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`)
    );
    const combinedFiles = [...files, ...newFiles];
    const nextFiles = combinedFiles.slice(0, MAX_TICKET_ATTACHMENTS);
    const tooManyFiles = combinedFiles.length > MAX_TICKET_ATTACHMENTS;

    setFiles(nextFiles);
    setFileIssues([
      ...oversizedFiles.map((file) => `${file.name} is over the 10 MB limit.`),
      ...(tooManyFiles ? [`You can attach up to ${MAX_TICKET_ATTACHMENTS} files.`] : [])
    ]);
    setMessage(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(fileToRemove: File) {
    setFiles((current) =>
      current.filter(
        (file) =>
          file.name !== fileToRemove.name ||
          file.size !== fileToRemove.size ||
          file.lastModified !== fileToRemove.lastModified
      )
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg bg-white p-5 shadow-soft sm:p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Ticket title <span className="text-urgent">*</span></span>
        <input
          name="title"
          required
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          placeholder="e.g. Revised architectural floor plans"
        />
      </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Requesting department{departments.length > 0 && <span className="text-urgent"> *</span>}</span>
          <select
            name="department_id"
            required={referencesLoaded && departments.length > 0}
            disabled={!referencesLoaded && !referenceError}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          >
            <option value="">{referencesLoaded ? "Select department" : "Loading departments..."}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Related project{projects.length > 0 && <span className="text-urgent"> *</span>}</span>
          <select
            name="project_id"
            required={referencesLoaded && projects.length > 0}
            disabled={!referencesLoaded && !referenceError}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          >
            <option value="">{referencesLoaded ? "Select project" : "Loading projects..."}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code ? `${project.project_code} - ` : ""}{project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-slate-700">Discipline / support group</legend>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="radio"
              name="discipline_id"
              value=""
              checked={selectedDiscipline === ""}
              onChange={() => setSelectedDiscipline("")}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 peer-checked:border-accent peer-checked:bg-blue-50 peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              Let PMSG route this
            </span>
          </label>
          {disciplines.map((discipline) => (
            <label key={discipline.id} className="cursor-pointer">
              <input
                type="radio"
                name="discipline_id"
                value={discipline.id}
                checked={selectedDiscipline === String(discipline.id)}
                onChange={() => setSelectedDiscipline(String(discipline.id))}
                disabled={!referencesLoaded}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 peer-checked:border-accent peer-checked:bg-blue-50 peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {discipline.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Request category</span>
          <select
            name="category_id"
            disabled={!referencesLoaded && !referenceError}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          >
            <option value="">{referencesLoaded ? "General request" : "Loading categories..."}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <fieldset className="grid content-start gap-2">
          <legend className="text-sm font-semibold text-slate-700">Priority</legend>
          <div className="flex gap-2">
            {priorities.map((priority) => (
              <label key={priority} className="cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={priority}
                  checked={selectedPriority === priority}
                  onChange={() => setSelectedPriority(priority)}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-medium capitalize text-slate-700 peer-checked:border-accent peer-checked:bg-blue-50 peer-checked:text-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {priority}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {referenceError && (
        <p role="status" className="text-sm text-amber-700">
          {referenceError}
        </p>
      )}
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Description of concern or request <span className="text-urgent">*</span></span>
        <textarea
          name="description"
          required
          rows={5}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring"
          placeholder="Describe the project, drawing/document reference, deadline, and expected output."
        />
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Supporting attachments</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isSubmitting || Boolean(createdTicketId)}
          onChange={handleFileChange}
          className="sr-only"
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose or drop attachment files"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
          className={`grid min-h-24 cursor-pointer place-items-center rounded-md border border-dashed px-4 py-4 text-center transition-colors duration-100 motion-reduce:transition-none ${
            isDragging ? "border-accent bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-blue-50"
          }`}
        >
          <span>
            <Paperclip className="mx-auto h-5 w-5 text-slate-500" />
            <span className="mt-2 block text-sm font-semibold text-slate-700">
              Drop files here, or <span className="text-accent">browse</span>
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Up to {MAX_TICKET_ATTACHMENTS} files, {MAX_TICKET_ATTACHMENT_SIZE / 1024 / 1024} MB each
            </span>
          </span>
        </div>
        {(files.length > 0 || uploadedFiles.length > 0) && (
          <ul className="grid gap-1.5">
            {files.map((file) => {
              const wasUploaded = uploadedFiles.includes(file.name);
              const failed = failedFiles.includes(file.name);

              return (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className={`flex min-h-9 items-center justify-between gap-3 rounded-md px-3 py-1.5 text-xs ${
                    wasUploaded
                      ? "bg-green-50 text-resolved"
                      : failed
                        ? "bg-red-50 text-urgent"
                        : "bg-blue-50 text-slate-700"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {file.name} · {fileSizeLabel(file.size)}
                    {wasUploaded
                      ? " · Uploaded"
                      : failed
                        ? " · Upload failed"
                        : isSubmitting
                          ? " · Uploading..."
                          : " · Ready to upload"}
                  </span>
                  <button
                    type="button"
                    disabled={isSubmitting || Boolean(createdTicketId)}
                    onClick={() => removeFile(file)}
                    aria-label={`Remove ${file.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 hover:bg-white hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {fileIssues.map((issue) => (
          <p key={issue} role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-urgent">
            {issue}
          </p>
        ))}
      </div>

      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      {createdTicketId && (
        <Link href={`/tickets/${createdTicketId}`} className="text-sm font-semibold text-accent">
          Open created ticket
        </Link>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={isSubmitting || Boolean(createdTicketId)} className="sm:w-fit">
          <Send className="h-4 w-4" />
          {isSubmitting ? "Submitting..." : "Submit ticket"}
        </Button>
        <Link
          href="/tickets"
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
