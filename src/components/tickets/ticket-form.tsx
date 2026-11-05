"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { PriorityMatrixGuide } from "@/components/tickets/priority-matrix-guide";
import { calculateTicketPriority } from "@/lib/utils";
import { createTicket } from "@/lib/actions";
import {
  ACCEPTED_TICKET_ATTACHMENT_TYPES,
  MAX_TICKET_ATTACHMENT_SIZE,
  MAX_TICKET_ATTACHMENTS,
  uploadTicketAttachments
} from "@/lib/attachments";
import type { RequestType, SimilarTicket, TicketImpact, TicketUrgency } from "@/lib/types";

function fileSizeLabel(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function TicketForm({ teamSlug = "it-support" }: { teamSlug?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [impact, setImpact] = useState<TicketImpact>("medium");
  const [urgency, setUrgency] = useState<TicketUrgency>("medium");
  const [titleText, setTitleText] = useState("");
  const [descriptionText, setDescriptionText] = useState("");
  const [similarTickets, setSimilarTickets] = useState<SimilarTicket[]>([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("general");
  const [message, setMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const priority = calculateTicketPriority(impact, urgency);

  useEffect(() => {
    if (titleText.trim().length < 8) {
      setSimilarTickets([]);
      setCheckingSimilar(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCheckingSimilar(true);
      try {
        const response = await fetch("/api/ticket-similar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          signal: controller.signal,
          body: JSON.stringify({
            title: titleText,
            description: descriptionText,
          })
        });
        if (!response.ok) return;
        const result = (await response.json()) as { tickets?: SimilarTicket[] };
        setSimilarTickets(result.tickets ?? []);
      } catch {
        if (!controller.signal.aborted) setSimilarTickets([]);
      } finally {
        if (!controller.signal.aborted) setCheckingSimilar(false);
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [titleText, descriptionText]);

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
    <form onSubmit={handleSubmit} className="grid min-w-0 gap-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-7">
      <input type="hidden" name="service_team_slug" value={teamSlug} />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-slate-700">Ticket title <span className="text-urgent">*</span></span>
        <input
          name="title"
          required
          maxLength={200}
          value={titleText}
          onChange={(event) => setTitleText(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-ring"
          placeholder="e.g. Revised floor plans"
        />
      </label>
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-slate-700">Request type</span>
          <select
            name="request_type"
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as RequestType)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-ring"
          >
            <option value="general">General request</option>
            <option value="access_request">Access request</option>
            <option value="incident_report">Incident report</option>
          </select>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <input
          type="checkbox"
          name="is_confidential"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800">Confidential ticket</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-600">
            Visible only to you, assigned staff, and administrators.
          </span>
        </span>
      </label>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Impact
          <select name="impact" value={impact} onChange={(event) => setImpact(event.target.value as TicketImpact)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring">
            <option value="high">High — affects critical service or many users</option>
            <option value="medium">Medium — disrupts a team or important task</option>
            <option value="low">Low — limited impact; workaround available</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-700">
          Urgency
          <select name="urgency" value={urgency} onChange={(event) => setUrgency(event.target.value as TicketUrgency)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring">
            <option value="high">High — needs attention immediately</option>
            <option value="medium">Medium — needs attention soon</option>
            <option value="low">Low — can be scheduled</option>
          </select>
        </label>
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900 md:col-span-2">
          Priority matrix result: <strong className="capitalize">{priority}</strong>. Priority is assigned from impact and urgency.
        </p>
        <div className="md:col-span-2"><PriorityMatrixGuide /></div>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Description <span className="text-urgent">*</span></span>
        <textarea
          name="description"
          required
          maxLength={10000}
          value={descriptionText}
          onChange={(event) => setDescriptionText(event.target.value)}
          rows={5}
          className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus-ring"
          placeholder={
            requestType === "access_request"
              ? "Describe the system, project, or files you need access to and why."
              : requestType === "incident_report"
                ? "Describe what happened, when it happened, and who or what was affected."
                : "Describe the project, drawing/document reference, deadline, and expected output."
          }
        />
      </label>
      {(checkingSimilar || similarTickets.length > 0) && (
        <section aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-950">
            {checkingSimilar ? "Checking for similar open tickets…" : "Similar open tickets"}
          </h2>
          {similarTickets.length > 0 ? (
            <ul className="mt-2 grid gap-2">
              {similarTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link href={`/tickets/${ticket.id}`} className="rounded font-semibold text-accent hover:underline focus-ring">
                    {ticket.ticket_no ?? `Ticket #${ticket.id}`}: {ticket.title}
                  </Link>
                  <span className="ml-2 text-xs capitalize text-amber-900">
                    {String(ticket.status).replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : checkingSimilar ? (
            <p className="mt-1 text-xs text-amber-900">We’ll show any matching tickets you have permission to view.</p>
          ) : null}
          <p className="mt-2 text-xs text-amber-900">These are suggestions; you can still submit if this is a separate request.</p>
        </section>
      )}
      <div className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Supporting attachments</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TICKET_ATTACHMENT_TYPES}
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
          className={`grid min-h-28 cursor-pointer place-items-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors duration-100 motion-reduce:transition-none ${
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
          <div key={issue} className="text-xs"><FeedbackMessage type="error">
            {issue}
          </FeedbackMessage></div>
        ))}
      </div>

      {message && <FeedbackMessage type="error">{message}</FeedbackMessage>}
      {createdTicketId && (
        <Link href={`/tickets/${createdTicketId}`} className="text-sm font-semibold text-accent">
          Open created ticket
        </Link>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button type="submit" loading={isSubmitting} disabled={Boolean(createdTicketId)} className="sm:w-fit">
          <Send className="h-4 w-4" />
          {isSubmitting ? "Opening ticket..." : "Open ticket"}
        </Button>
        <Link
          href="/tickets"
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
