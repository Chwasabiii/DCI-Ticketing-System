export type TicketDraft = {
  id: string;
  title: string;
  description: string;
  requestType: string;
  serviceCategory: string;
  impact: string;
  urgency: string;
  teamSlug: string;
  ccgRequestType?: string;
  ccgRequestTypes?: string[];
  ccgRequestScope?: string;
  updatedAt: string;
};

const storageKey = "dci-ticket-drafts-v1";

function isTicketDraft(value: unknown): value is TicketDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<TicketDraft>;
  return typeof draft.id === "string"
    && ["service_request", "access_request", "incident_report", "general"].includes(draft.requestType ?? "")
    && ["hardware", "software", "network", "microsoft", "security", "other_services"].includes(draft.serviceCategory ?? "")
    && ["low", "medium", "high"].includes(draft.impact ?? "")
    && ["low", "medium", "high"].includes(draft.urgency ?? "")
    && ["it-support", "cost-control"].includes(draft.teamSlug ?? "")
    && typeof draft.title === "string"
    && typeof draft.description === "string"
    && typeof draft.requestType === "string"
    && typeof draft.serviceCategory === "string"
    && typeof draft.impact === "string"
    && typeof draft.urgency === "string"
    && typeof draft.teamSlug === "string"
    && typeof draft.updatedAt === "string"
    && Number.isFinite(Date.parse(draft.updatedAt))
    && (draft.ccgRequestType === undefined || typeof draft.ccgRequestType === "string")
    && (draft.ccgRequestTypes === undefined
      || (Array.isArray(draft.ccgRequestTypes) && draft.ccgRequestTypes.every((type) => typeof type === "string")))
    && (draft.ccgRequestScope === undefined || typeof draft.ccgRequestScope === "string");
}

export function readTicketDrafts(): TicketDraft[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(isTicketDraft).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      : [];
  } catch { return []; }
}

export function saveTicketDraft(draft: TicketDraft): TicketDraft | null {
  try {
    const drafts = readTicketDrafts();
    const existing = drafts.find((item) => item.id === draft.id);
    const updatedAt = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0)).toISOString();
    const savedDraft = { ...draft, updatedAt };
    localStorage.setItem(storageKey, JSON.stringify([savedDraft, ...drafts.filter((item) => item.id !== draft.id)]));
    return savedDraft;
  } catch {
    return null;
  }
}

export function deleteTicketDraft(id: string): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(readTicketDrafts().filter((item) => item.id !== id)));
    return true;
  } catch {
    return false;
  }
}
