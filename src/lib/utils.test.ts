import { describe, expect, it } from "vitest";
import { addBusinessDays, calculateTicketPriority, formatDateTime, getTicketSlaIndicators } from "./utils";

describe("ticket timestamp formatting", () => {
  it("displays UTC timestamps in the app timezone and labels that timezone", () => {
    const formatted = formatDateTime("2026-11-10T08:38:00.000Z");
    expect(formatted).toContain("Nov 10, 2026");
    expect(formatted).toContain("4:38 PM");
    expect(formatted).toContain("GMT+8");
  });
});

describe("calculateTicketPriority", () => {
  it.each([
    ["high", "high", "urgent"],
    ["high", "medium", "high"],
    ["high", "low", "medium"],
    ["medium", "high", "high"],
    ["medium", "medium", "medium"],
    ["medium", "low", "low"],
    ["low", "high", "medium"],
    ["low", "medium", "low"],
    ["low", "low", "low"]
  ] as const)("maps %s impact and %s urgency to %s", (impact, urgency, priority) => {
    expect(calculateTicketPriority(impact, urgency)).toBe(priority);
  });
});

describe("business-day SLA calculations", () => {
  it("skips weekends when adding business days", () => {
    const friday = Date.parse("2026-11-06T09:00:00.000Z");
    expect(new Date(addBusinessDays(friday, 1)).toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  it("reports both missed response and resolution targets", () => {
    const ticket = {
      id: 1,
      title: "Test ticket",
      priority: "high",
      status: "in_progress",
      created_at: "2026-11-06T09:00:00.000Z",
      reopened_at: null,
      resolved_at: null,
      ccg_request_type: null,
      ccg_stage_due_at: null,
      first_response_at: null
    } as const;
    const policies = [{
      priority_group: "high",
      first_response_business_days: 1,
      resolution_business_days: 2
    }] as const;

    expect(getTicketSlaIndicators(ticket, [...policies], Date.parse("2026-11-10T10:00:00.000Z")).map(({ key }) => key))
      .toEqual(["response", "resolution"]);
  });
});
