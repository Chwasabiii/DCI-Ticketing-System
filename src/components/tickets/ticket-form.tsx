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
import type { RequestType, ServiceCategory, SimilarTicket, TicketImpact, TicketUrgency } from "@/lib/types";
import { deleteTicketDraft, readTicketDrafts, saveTicketDraft, type TicketDraft } from "@/lib/ticket-drafts";

const serviceCategories: Array<{ value: ServiceCategory; label: string }> = [
  { value: "hardware", label: "Hardware" },
  { value: "software", label: "Software" },
  { value: "network", label: "Network" },
  { value: "microsoft", label: "Microsoft" },
  { value: "security", label: "Security" },
  { value: "other_services", label: "Other services" }
];

function fileSizeLabel(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function draftHasContent(draft: TicketDraft) {
  return Boolean(
    draft.title.trim()
    || draft.description.trim()
    || draft.requestType !== "service_request"
    || (draft.teamSlug !== "cost-control" && draft.serviceCategory !== "hardware")
    || draft.impact !== "medium"
    || draft.urgency !== "medium"
    || (draft.teamSlug === "cost-control" && (
      (draft.ccgRequestTypes ?? [draft.ccgRequestType ?? "unit_rate"]).join(",") !== "unit_rate"
      || (draft.ccgRequestScope ?? "whole_boq") !== "whole_boq"
    ))
  );
}

function draftContentKey(draft: TicketDraft | null) {
  if (!draft) return "";
  return JSON.stringify({
    title: draft.title,
    description: draft.description,
    requestType: draft.requestType,
    serviceCategory: draft.serviceCategory,
    impact: draft.impact,
    urgency: draft.urgency,
    teamSlug: draft.teamSlug,
    ccgRequestType: draft.ccgRequestType,
    ccgRequestTypes: draft.ccgRequestTypes,
    ccgRequestScope: draft.ccgRequestScope
  });
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
  const [requestType, setRequestType] = useState<RequestType>("service_request");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>("hardware");
  const [ccgRequestType, setCcgRequestType] = useState("unit_rate");
  const [ccgRequestTypes, setCcgRequestTypes] = useState<string[]>(["unit_rate"]);
  const [ccgRequestScope, setCcgRequestScope] = useState("whole_boq");
  const isCcg = teamSlug === "cost-control";
  const [message, setMessage] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftId, setDraftId] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const lastSavedDraftRef = useRef<TicketDraft | null>(null);
  const currentDraftRef = useRef<TicketDraft | null>(null);
  const hasUnsavedChangesRef = useRef(false);
  const historyGuardActiveRef = useRef(false);
  const bypassHistoryGuardRef = useRef(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const leavePromptRef = useRef(false);
  const priority = calculateTicketPriority(impact, urgency);

  const currentDraft: TicketDraft = {
    id: draftId,
    title: titleText,
    description: descriptionText,
    requestType,
    serviceCategory,
    impact,
    urgency,
    teamSlug,
    ccgRequestType,
    ccgRequestTypes,
    ccgRequestScope,
    updatedAt: new Date().toISOString()
  };
  const hasUnsavedChanges = draftReady
    && !createdTicketId
    && draftHasContent(currentDraft)
    && draftContentKey(currentDraft) !== draftContentKey(lastSavedDraftRef.current);
  currentDraftRef.current = draftId ? currentDraft : null;
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  leavePromptRef.current = leavePrompt;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedId = new URLSearchParams(window.location.search).get("draft");
      const drafts = readTicketDrafts();
      const draft = (requestedId ? drafts.find((item) => item.id === requestedId && item.teamSlug === teamSlug) : undefined)
        ?? drafts.find((item) => item.teamSlug === teamSlug);
      const id = draft?.id ?? crypto.randomUUID();
      setDraftId(id);
      if (draft) {
        // Restore first; autosave stays disabled until hydration completes.
        lastSavedDraftRef.current = draft;
        setTitleText(draft.title);
        setDescriptionText(draft.description);
        setRequestType(draft.requestType as RequestType);
        setServiceCategory(draft.serviceCategory as ServiceCategory);
        const savedCcgTypes = draft.ccgRequestTypes?.length ? draft.ccgRequestTypes : [draft.ccgRequestType ?? "unit_rate"];
        setCcgRequestTypes(savedCcgTypes);
        setCcgRequestType(savedCcgTypes[0]);
        setCcgRequestScope(draft.ccgRequestScope ?? "whole_boq");
        setImpact(draft.impact as TicketImpact);
        setUrgency(draft.urgency as TicketUrgency);
        setDraftSavedAt(draft.updatedAt);
      }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [teamSlug]);

  useEffect(() => {
    if (!draftReady || createdTicketId || !draftId) return;
    const timer = window.setTimeout(() => {
      const draftToSave: TicketDraft = {
        id: draftId,
        title: titleText,
        description: descriptionText,
        requestType,
        serviceCategory,
        impact,
        urgency,
        teamSlug,
        ccgRequestType,
        ccgRequestTypes,
        ccgRequestScope,
        updatedAt: new Date().toISOString()
      };
      const isMeaningful = draftHasContent(draftToSave);
      if (isMeaningful && draftContentKey(draftToSave) === draftContentKey(lastSavedDraftRef.current)) return;
      if (!isMeaningful) {
        if (lastSavedDraftRef.current) {
          if (!deleteTicketDraft(draftId)) {
            setDraftError("Could not remove the empty draft from this device.");
            return;
          }
          lastSavedDraftRef.current = null;
          setDraftSavedAt(null);
        }
        return;
      }
      const saved = saveTicketDraft(draftToSave);
      if (!saved) {
        setDraftError("Could not save your draft on this device. Check available browser storage.");
        return;
      }
      lastSavedDraftRef.current = saved;
      setDraftSavedAt(saved.updatedAt);
      setDraftError(null);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draftReady, draftId, titleText, descriptionText, requestType, serviceCategory, impact, urgency, teamSlug, ccgRequestType, ccgRequestTypes, ccgRequestScope, createdTicketId]);

  function saveDraftNow(draft = currentDraftRef.current) {
    if (!draftReady || !draft) return false;
    if (!draftHasContent(draft)) {
      setDraftError("Add ticket details before saving a draft.");
      return false;
    }
    const saved = saveTicketDraft(draft);
    if (!saved) {
      setDraftError("Could not save your draft on this device. Check available browser storage.");
      return false;
    }
    lastSavedDraftRef.current = saved;
    setDraftSavedAt(saved.updatedAt);
    setDraftError(null);
    return true;
  }

  function releaseHistoryGuardAndNavigate(navigate: () => void) {
    if (!historyGuardActiveRef.current) {
      navigate();
      return;
    }
    historyGuardActiveRef.current = false;
    bypassHistoryGuardRef.current = true;
    pendingNavigationRef.current = navigate;
    window.history.back();
  }

  function navigateAfterPrompt() {
    const navigate = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setLeavePrompt(false);
    navigate?.();
  }

  function discardDraftAndLeave() {
    if (draftId && !deleteTicketDraft(draftId)) {
      setDraftError("Could not discard the draft from this device. Please try again.");
      return;
    }
    lastSavedDraftRef.current = null;
    setDraftSavedAt(null);
    setDraftError(null);
    navigateAfterPrompt();
  }

  useEffect(() => {
    if (!draftReady || !draftId) return;
    const onStorage = () => {
      if (hasUnsavedChangesRef.current) return;
      const remoteDraft = readTicketDrafts().find((draft) => draft.id === draftId);
      const currentSaved = lastSavedDraftRef.current;
      if (remoteDraft && (!currentSaved || Date.parse(remoteDraft.updatedAt) > Date.parse(currentSaved.updatedAt))) {
        lastSavedDraftRef.current = remoteDraft;
        setTitleText(remoteDraft.title);
        setDescriptionText(remoteDraft.description);
        setRequestType(remoteDraft.requestType as RequestType);
        setServiceCategory(remoteDraft.serviceCategory as ServiceCategory);
        const savedCcgTypes = remoteDraft.ccgRequestTypes?.length
          ? remoteDraft.ccgRequestTypes
          : [remoteDraft.ccgRequestType ?? "unit_rate"];
        setCcgRequestTypes(savedCcgTypes);
        setCcgRequestType(savedCcgTypes[0] ?? "unit_rate");
        setCcgRequestScope(remoteDraft.ccgRequestScope ?? "whole_boq");
        setImpact(remoteDraft.impact as TicketImpact);
        setUrgency(remoteDraft.urgency as TicketUrgency);
        setDraftSavedAt(remoteDraft.updatedAt);
      } else if (!remoteDraft && currentSaved) {
        lastSavedDraftRef.current = null;
        setDraftId(crypto.randomUUID());
        setTitleText("");
        setDescriptionText("");
        setRequestType("service_request");
        setServiceCategory("hardware");
        setCcgRequestTypes(["unit_rate"]);
        setCcgRequestType("unit_rate");
        setCcgRequestScope("whole_boq");
        setImpact("medium");
        setUrgency("medium");
        setDraftSavedAt(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [draftReady, draftId]);

  // Persist the latest edits synchronously on pagehide; restoration keeps refresh prompt-free.
  useEffect(() => {
    if (!draftReady) return;
    const onPageHide = () => {
      const draft = currentDraftRef.current;
      if (!draft || createdTicketId) return;
      if (draftHasContent(draft)) {
        if (draftContentKey(draft) !== draftContentKey(lastSavedDraftRef.current)) {
          saveTicketDraft(draft);
        }
      } else if (lastSavedDraftRef.current) {
        deleteTicketDraft(draft.id);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [draftReady, createdTicketId]);

  useEffect(() => {
    if (!draftReady || !draftId || !hasUnsavedChanges) return;
    const guardState = { ...(window.history.state ?? {}), __ticketDraftGuard: draftId };
    window.history.pushState(guardState, "", window.location.href);
    historyGuardActiveRef.current = true;
  }, [draftReady, draftId, hasUnsavedChanges]);

  useEffect(() => {
    const onPopState = () => {
      if (bypassHistoryGuardRef.current) {
        bypassHistoryGuardRef.current = false;
        const navigate = pendingNavigationRef.current;
        pendingNavigationRef.current = null;
        navigate?.();
        return;
      }
      if (!historyGuardActiveRef.current) return;
      if (!hasUnsavedChangesRef.current) {
        historyGuardActiveRef.current = false;
        return;
      }
      const guardState = { ...(window.history.state ?? {}), __ticketDraftGuard: draftId };
      window.history.pushState(guardState, "", window.location.href);
      historyGuardActiveRef.current = true;
      if (leavePromptRef.current) return;
      pendingNavigationRef.current = () => {
        historyGuardActiveRef.current = false;
        bypassHistoryGuardRef.current = true;
        window.history.go(-2);
      };
      setLeavePrompt(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [draftId]);

  useEffect(() => {
    if (hasUnsavedChanges || !historyGuardActiveRef.current) return;
    historyGuardActiveRef.current = false;
    bypassHistoryGuardRef.current = true;
    window.history.back();
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChangesRef.current || event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      const href = `${destination.pathname}${destination.search}${destination.hash}`;
      pendingNavigationRef.current = () => releaseHistoryGuardAndNavigate(() => router.push(href));
      setLeavePrompt(true);
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [router]);

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
      const draftDeleted = deleteTicketDraft(draftId);
      if (!draftDeleted) setDraftError("Ticket created, but its saved draft could not be removed from this device.");
      else {
        lastSavedDraftRef.current = null;
        setDraftSavedAt(null);
      }
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

      if (!draftDeleted) return;
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
      {isCcg && <input type="hidden" name="service_category" value="other_services" />}
      {isCcg && <input type="hidden" name="ccg_request_type" value={ccgRequestTypes[0] ?? ""} />}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-slate-700">Ticket title <span className="text-urgent">*</span></span>
          <input name="title" required maxLength={200} value={titleText} onChange={(event) => setTitleText(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-ring" placeholder={isCcg ? "e.g. Unit rate for office renovation" : "e.g. Revised floor plans"} />
        </label>
        {isCcg ? <>
          <input type="hidden" name="request_type" value="service_request" />
          <fieldset className="grid min-w-0 gap-2 sm:col-span-2">
            <legend className="text-sm font-semibold text-slate-700">What does this CCG request include? Select all that apply.</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["unit_rate", "Unit rate"],
                ["vendor_list", "Vendor list"],
                ["tor_contracts", "TOR / contracts"]
              ].map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="ccg_request_types"
                    value={value}
                    checked={ccgRequestTypes.includes(value)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...ccgRequestTypes, value]
                        : ccgRequestTypes.filter((type) => type !== value);
                      setCcgRequestTypes(next);
                      setCcgRequestType(next[0] ?? "");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-slate-500">Select multiple services to include them together in one CCG ticket. CCG records one shared database result and completes any required vendor follow-up for the selected services.</p>
          </fieldset>
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">Does this request include Procurement?</span>
            <select name="ccg_procurement_in_scope" required className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus-ring" defaultValue="false">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          {ccgRequestTypes.includes("unit_rate") && <div className="grid min-w-0 gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:col-span-2">
            <input type="hidden" name="ccg_request_scope" value={ccgRequestScope} />
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={ccgRequestScope === "whole_boq"}
                onChange={(event) => setCcgRequestScope(event.target.checked ? "whole_boq" : "per_material")}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">This is a bulk request for a whole BOQ</span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">Check this to include many BOQ items in one ticket. Describe the project and attach the BOQ or item list. Leave it unchecked for a request about one material or system.</span>
              </span>
            </label>
          </div>}
        </> : <>
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-slate-700">Request type</span>
          <select
            name="request_type"
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as RequestType)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-ring"
          >
            <option value="service_request">Service request</option>
            <option value="access_request">Access request</option>
            <option value="incident_report">Incident report</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-semibold text-slate-700">Service category</span>
          <select
            name="service_category"
            value={serviceCategory}
            onChange={(event) => setServiceCategory(event.target.value as ServiceCategory)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-ring"
          >
            {serviceCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </label>
        <p className="-mt-2 text-xs leading-5 text-slate-500 sm:col-span-2">
          {requestType === "incident_report"
            ? "Choose the affected service. Incidents go through IT inspection and root cause analysis."
            : requestType === "access_request"
              ? "Choose the system or service you need access to."
              : "Choose the service area that best matches the help you need."}
        </p>
        </>}
      </div>

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
          Requested priority: <strong className="capitalize">{priority}</strong>, based on your reported impact and urgency.
        </p>
        {(impact === "high" || urgency === "high") && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 md:col-span-2">
            High impact or urgency is reviewed by the service team before it sets the ticket SLA. A single-user device issue, such as a keyboard problem, should usually be Low impact unless it blocks critical work.
          </p>
        )}
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
          placeholder={isCcg
            ? ccgRequestTypes.length > 1
              ? "List the project and details for each selected CCG service. Include quantities, materials, vendor criteria, and document references as applicable."
              : ccgRequestType === "unit_rate"
              ? "Include the project, BOQ or material/system, quantities, location, and required date."
              : ccgRequestType === "vendor_list"
                ? "Describe the materials or system, project location, and any vendor criteria or required date."
                : "Identify the TOR / contract type, project, and reference or sample you need."
            : requestType === "access_request"
              ? "Describe the system, project, or files you need access to and why."
              : requestType === "incident_report"
                ? "Describe what happened, when it happened, which service was affected, and any steps already taken."
                : "Describe the service you need, the outcome you expect, and any relevant deadline or reference."
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
      {draftError && <FeedbackMessage type="error">{draftError}</FeedbackMessage>}
      {createdTicketId && (
        <Link href={`/tickets/${createdTicketId}`} className="text-sm font-semibold text-accent">
          Open created ticket
        </Link>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button type="button" variant="secondary" disabled={!draftReady || Boolean(createdTicketId)} onClick={() => saveDraftNow()} className="sm:w-fit">
          <span>Save draft</span>
        </Button>
        {draftSavedAt && <span role="status" className="text-xs text-slate-500">Draft saved at {new Date(draftSavedAt).toLocaleTimeString()} on this device.</span>}
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
      {leavePrompt && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
        <section role="alertdialog" aria-modal="true" aria-labelledby="draft-leave-title" aria-describedby="draft-leave-description" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
          <h2 id="draft-leave-title" className="text-base font-bold text-navy">Do you want to save this draft?</h2>
          <p id="draft-leave-description" className="mt-2 text-sm leading-6 text-slate-600">Save your changes to continue them later, or discard them before leaving.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { pendingNavigationRef.current = null; setLeavePrompt(false); }} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={discardDraftAndLeave} className="min-h-10 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50">Discard</button>
            <button type="button" onClick={() => { if (saveDraftNow()) navigateAfterPrompt(); }} className="min-h-10 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-slate-800">Save draft</button>
          </div>
        </section>
      </div>}
    </form>
  );
}
