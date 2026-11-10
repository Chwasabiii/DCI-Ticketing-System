import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteTicketDraft, readTicketDrafts, saveTicketDraft } from "./ticket-drafts";

const draft = {
  id: "draft-1",
  title: "Laptop setup",
  description: "Prepare a laptop",
  requestType: "service_request",
  serviceCategory: "hardware",
  impact: "medium",
  urgency: "medium",
  teamSlug: "it-support",
  updatedAt: "2026-11-10T08:00:00.000Z"
};

function installStorage(initialValue: string | null = null, shouldThrow = false) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set("dci-ticket-drafts-v1", initialValue);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (shouldThrow) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (shouldThrow) throw new Error("storage unavailable");
      values.set(key, value);
    }
  });
  return values;
}

afterEach(() => vi.unstubAllGlobals());

describe("ticket draft storage", () => {
  it("ignores corrupted records and returns valid drafts newest first", () => {
    installStorage(JSON.stringify([
      draft,
      { ...draft, id: "draft-2", updatedAt: "2026-11-10T09:00:00.000Z" },
      { ...draft, id: "invalid", updatedAt: "not-a-date" },
      null
    ]));

    expect(readTicketDrafts().map(({ id }) => id)).toEqual(["draft-2", "draft-1"]);
  });

  it("returns null when the browser cannot save draft data", () => {
    installStorage(null, true);

    expect(saveTicketDraft(draft)).toBeNull();
  });

  it("reports failed deletes instead of claiming success", () => {
    installStorage(null, true);

    expect(deleteTicketDraft(draft.id)).toBe(false);
  });
});
