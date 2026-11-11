import { describe, expect, it } from "vitest";
import { addBusinessDays, addBusinessSeconds, calculateTicketPriority, formatDateTime, formatTicketCount, getTicketResolutionDueLabel, getTicketSlaIndicators } from "./utils";

describe("ticket timestamp formatting", () => {
  it("displays UTC timestamps in the app timezone and labels that timezone", () => {
    const formatted = formatDateTime("2026-11-10T08:38:00.000Z");
    expect(formatted).toContain("Nov 10, 2026");
    expect(formatted).toContain("4:38 PM");
    expect(formatted).toContain("GMT+8");
  });
});

describe("ticket count labels", () => {
  it("uses the singular form for one ticket", () => {
    expect(formatTicketCount(1)).toBe("1 ticket");
  });

  it("uses the plural form for zero and multiple tickets", () => {
    expect(formatTicketCount(0)).toBe("0 tickets");
    expect(formatTicketCount(2)).toBe("2 tickets");
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

describe("office-hours SLA calculations", () => {
  it("counts a business day as eight hours from the next office opening", () => {
    const mondayOpening = Date.parse("2026-11-09T01:00:00.000Z");
    expect(new Date(addBusinessDays(mondayOpening, 1)).toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  it("starts before-hours tickets at 9 a.m. Manila time", () => {
    const beforeOpening = Date.parse("2026-11-09T00:00:00.000Z");
    expect(new Date(addBusinessSeconds(beforeOpening, 60 * 60)).toISOString()).toBe("2026-11-09T02:00:00.000Z");
  });

  it("carries remaining business time into the next workday", () => {
    const afternoon = Date.parse("2026-11-09T08:00:00.000Z");
    expect(new Date(addBusinessSeconds(afternoon, 2 * 60 * 60)).toISOString()).toBe("2026-11-10T02:00:00.000Z");
  });

  it("starts after-hours tickets at the next weekday opening", () => {
    const friday = Date.parse("2026-11-06T09:00:00.000Z");
    expect(new Date(addBusinessDays(friday, 1)).toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  it("starts weekend tickets at Monday 9 a.m. Manila time", () => {
    const saturday = Date.parse("2026-11-07T04:00:00.000Z");
    expect(new Date(addBusinessSeconds(saturday, 60 * 60)).toISOString()).toBe("2026-11-09T02:00:00.000Z");
  });

  it("skips configured holiday dates when adding office hours", () => {
    const fridayAfternoon = Date.parse("2026-11-06T08:00:00.000Z");
    const holidays = ["2026-11-09"];
    expect(new Date(addBusinessSeconds(fridayAfternoon, 2 * 60 * 60, holidays)).toISOString())
      .toBe("2026-11-10T02:00:00.000Z");
  });

  it("moves a deadline that starts on a holiday to the next working day", () => {
    const holidayMorning = Date.parse("2026-11-09T01:00:00.000Z");
    expect(new Date(addBusinessDays(holidayMorning, 1, ["2026-11-09"])).toISOString())
      .toBe("2026-11-10T09:00:00.000Z");
  });

  it("uses configured holidays for the requester-facing resolution label", () => {
    const ticket = {
      priority: "high",
      status: "in_progress",
      created_at: "2026-11-06T08:00:00.000Z",
      reopened_at: null,
      resolved_at: null,
      ccg_request_type: null,
      ccg_stage_due_at: null
    } as const;
    const policies = [{
      priority_group: "high",
      first_response_business_days: 1,
      resolution_business_days: 1,
      holiday_dates: ["2026-11-09"]
    }] as const;

    expect(getTicketResolutionDueLabel(ticket, [...policies], Date.parse("2026-11-10T07:59:00.000Z")))
      .toBe("Due today");
  });

  it("keeps the exact 5 p.m. boundary at the end of the current workday", () => {
    const mondayAfternoon = Date.parse("2026-11-09T08:00:00.000Z");
    expect(new Date(addBusinessSeconds(mondayAfternoon, 60 * 60)).toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  it("subtracts business time across evenings and weekends", () => {
    const mondayOpening = Date.parse("2026-11-09T01:00:00.000Z");
    expect(new Date(addBusinessSeconds(mondayOpening, -60 * 60)).toISOString()).toBe("2026-11-06T08:00:00.000Z");
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

  it("starts SLA warnings after 75 percent of office time has elapsed", () => {
    const ticket = {
      id: 1,
      title: "Test ticket",
      priority: "high",
      status: "in_progress",
      created_at: "2026-11-09T01:00:00.000Z",
      reopened_at: null,
      resolved_at: null,
      ccg_request_type: null,
      ccg_stage_due_at: null,
      first_response_at: null
    } as const;
    const policies = [{
      priority_group: "high",
      first_response_business_days: 1,
      resolution_business_days: 1
    }] as const;

    expect(getTicketSlaIndicators(ticket, [...policies], Date.parse("2026-11-09T06:59:59.000Z"))).toEqual([]);
    expect(getTicketSlaIndicators(ticket, [...policies], Date.parse("2026-11-09T07:00:00.000Z")).map(({ key }) => key))
      .toEqual(["response", "resolution"]);
  });

  it("uses the resolution timestamp as a response for completed tickets without a first response timestamp", () => {
    const ticket = {
      id: 1,
      title: "Test ticket",
      priority: "high",
      status: "resolved",
      created_at: "2026-11-06T09:00:00.000Z",
      reopened_at: null,
      resolved_at: "2026-11-09T08:00:00.000Z",
      ccg_request_type: null,
      ccg_stage_due_at: null,
      first_response_at: null
    } as const;
    const policies = [{
      priority_group: "high",
      first_response_business_days: 1,
      resolution_business_days: 2
    }] as const;

    expect(getTicketSlaIndicators(ticket, [...policies], Date.parse("2026-11-10T10:00:00.000Z")))
      .toEqual([]);
  });

  it("reports a missed response SLA for a completed ticket resolved after the response deadline", () => {
    const ticket = {
      id: 1,
      title: "Test ticket",
      priority: "high",
      status: "resolved",
      created_at: "2026-11-06T09:00:00.000Z",
      reopened_at: null,
      resolved_at: "2026-11-10T10:00:00.000Z",
      ccg_request_type: null,
      ccg_stage_due_at: null,
      first_response_at: null
    } as const;
    const policies = [{
      priority_group: "high",
      first_response_business_days: 1,
      resolution_business_days: 2
    }] as const;

    expect(getTicketSlaIndicators(ticket, [...policies], Date.parse("2026-11-11T10:00:00.000Z")).map(({ key }) => key))
      .toEqual(["response", "resolution"]);
  });
});
