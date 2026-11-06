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
  ccgRequestScope?: string;
  updatedAt: string;
};

const storageKey = "dci-ticket-drafts-v1";

export function readTicketDrafts(): TicketDraft[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value as TicketDraft[] : [];
  } catch { return []; }
}

export function saveTicketDraft(draft: TicketDraft) {
  const drafts = readTicketDrafts();
  localStorage.setItem(storageKey, JSON.stringify([draft, ...drafts.filter((item) => item.id !== draft.id)]));
}

export function deleteTicketDraft(id: string) {
  localStorage.setItem(storageKey, JSON.stringify(readTicketDrafts().filter((item) => item.id !== id)));
}
