import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Priority, Ticket, TicketImpact, TicketSlaPolicy, TicketUrgency } from "@/lib/types";

const appTimeZone = "Asia/Manila";
const officeHoursOffsetMs = 8 * 60 * 60 * 1000;
const officeStartMinute = 9 * 60;
const officeEndMinute = 17 * 60;
const officeDaySeconds = (officeEndMinute - officeStartMinute) * 60;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("en", {
    timeZone: appTimeZone,
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTicketOverdue(ticket: Pick<Ticket, "ccg_request_type" | "ccg_stage_due_at" | "status">) {
  if (ticket.ccg_request_type) {
    return Boolean(ticket.ccg_stage_due_at
      && ticket.status !== "waiting_for_info"
      && !["resolved", "closed", "rejected"].includes(ticket.status)
      && Date.parse(ticket.ccg_stage_due_at) < Date.now());
  }
  return false;
}

export function addBusinessSeconds(start: number, businessSeconds: number, holidayDates: readonly string[] = []) {
  if (!Number.isFinite(start) || !Number.isFinite(businessSeconds)) return Number.NaN;
  if (businessSeconds === 0) return start;

  const direction = Math.sign(businessSeconds);
  let remaining = Math.abs(businessSeconds);
  let localTime = start + officeHoursOffsetMs;
  const holidays = new Set(holidayDates);

  while (remaining > 0) {
    const date = new Date(localTime);
    const weekday = date.getUTCDay();
    const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();

    if (direction > 0) {
      if (weekday === 0 || weekday === 6 || holidays.has(date.toISOString().slice(0, 10))) {
        date.setUTCDate(date.getUTCDate() + 1);
        date.setUTCHours(9, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }
      if (minuteOfDay < officeStartMinute) {
        date.setUTCHours(9, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }
      if (minuteOfDay >= officeEndMinute) {
        date.setUTCDate(date.getUTCDate() + 1);
        date.setUTCHours(9, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }

      const endOfWorkday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 17);
      const availableSeconds = (endOfWorkday - localTime) / 1000;
      const step = Math.min(remaining, availableSeconds);
      localTime += step * 1000;
      remaining -= step;
    } else {
      if (weekday === 0 || weekday === 6 || holidays.has(date.toISOString().slice(0, 10))) {
        date.setUTCDate(date.getUTCDate() - 1);
        date.setUTCHours(17, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }
      const startOfWorkday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 9);
      if (localTime <= startOfWorkday) {
        date.setUTCDate(date.getUTCDate() - 1);
        date.setUTCHours(17, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }
      if (minuteOfDay > officeEndMinute) {
        date.setUTCHours(17, 0, 0, 0);
        localTime = date.getTime();
        continue;
      }

      const availableSeconds = (localTime - startOfWorkday) / 1000;
      const step = Math.min(remaining, availableSeconds);
      localTime -= step * 1000;
      remaining -= step;
    }
  }

  return localTime - officeHoursOffsetMs;
}

export function addBusinessDays(start: number, businessDays: number, holidayDates: readonly string[] = []) {
  return addBusinessSeconds(start, businessDays * officeDaySeconds, holidayDates);
}

function businessDaysBetween(start: number, end: number) {
  const currentDay = new Date(start);
  currentDay.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setUTCHours(0, 0, 0, 0);
  let businessDays = 0;
  while (currentDay < endDay) {
    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    const weekday = currentDay.getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays;
}

function manilaBusinessDaysBetween(start: number, end: number, holidayDates: readonly string[] = []) {
  const currentDay = new Date(start + officeHoursOffsetMs);
  currentDay.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(end + officeHoursOffsetMs);
  endDay.setUTCHours(0, 0, 0, 0);
  const holidays = new Set(holidayDates);
  let businessDays = 0;
  while (currentDay < endDay) {
    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
    const weekday = currentDay.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(currentDay.toISOString().slice(0, 10))) businessDays += 1;
  }
  return businessDays;
}

function getSlaHolidayDates(policies: TicketSlaPolicy[]) {
  return policies[0]?.holiday_dates ?? [];
}

type TicketResolutionInput = Pick<Ticket, "priority" | "status" | "created_at" | "reopened_at" | "resolved_at" | "ccg_request_type" | "ccg_stage_due_at">;

export function getTicketResolutionDueLabel(ticket: TicketResolutionInput, policies: TicketSlaPolicy[], now = Date.now()) {
  if (ticket.ccg_request_type) {
    if (["resolved", "closed", "rejected"].includes(ticket.status)) {
      if (ticket.resolved_at && ticket.ccg_stage_due_at) {
        return Date.parse(ticket.resolved_at) <= Date.parse(ticket.ccg_stage_due_at) ? "Resolved within target" : "Resolved after target";
      }
      return "No active deadline";
    }
    if (ticket.status === "waiting_for_info") return "Paused while awaiting requester";
    if (!ticket.ccg_stage_due_at) return "CCG service deadline";
    return getCalendarBusinessDayCountdownLabel(Date.parse(ticket.ccg_stage_due_at), now);
  }

  const priorityGroup = ticket.priority === "high" || ticket.priority === "urgent" ? "high" : "standard";
  const targetDays = policies.find((policy) => policy.priority_group === priorityGroup)?.resolution_business_days;
  const startedAt = ticket.reopened_at ?? ticket.created_at;
  if (!targetDays || !startedAt) return "SLA target not set";
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return "SLA target not set";
  const holidays = getSlaHolidayDates(policies);
  const deadline = addBusinessDays(start, targetDays, holidays);

  if (ticket.resolved_at && ["resolved", "closed"].includes(ticket.status)) {
    return Date.parse(ticket.resolved_at) <= deadline ? "Resolved within target" : "Resolved after target";
  }
  if (["closed", "rejected"].includes(ticket.status)) return "No active deadline";
  return getBusinessDayCountdownLabel(deadline, now, holidays);
}

export function isTicketResolutionOverdue(ticket: TicketResolutionInput, policies: TicketSlaPolicy[], now = Date.now()) {
  return getTicketResolutionDueLabel(ticket, policies, now).startsWith("Overdue");
}

function getBusinessDayCountdownLabel(deadline: number, now: number, holidayDates: readonly string[] = []) {
  if (!Number.isFinite(deadline)) return "SLA target not set";
  if (now >= deadline) {
    const overdueDays = manilaBusinessDaysBetween(deadline, now, holidayDates);
    return overdueDays > 0 ? `Overdue by ${overdueDays} business ${overdueDays === 1 ? "day" : "days"}` : "Overdue";
  }
  const remainingDays = manilaBusinessDaysBetween(now, deadline, holidayDates);
  return remainingDays === 0
    ? "Due today"
    : `Due in ${remainingDays} business ${remainingDays === 1 ? "day" : "days"}`;
}

function getCalendarBusinessDayCountdownLabel(deadline: number, now: number) {
  if (!Number.isFinite(deadline)) return "SLA target not set";
  if (now >= deadline) {
    const overdueDays = businessDaysBetween(deadline, now);
    return overdueDays > 0 ? `Overdue by ${overdueDays} business ${overdueDays === 1 ? "day" : "days"}` : "Overdue";
  }
  const remainingDays = businessDaysBetween(now, deadline);
  return remainingDays === 0
    ? "Due today"
    : `Due in ${remainingDays} business ${remainingDays === 1 ? "day" : "days"}`;
}

export function calculateTicketPriority(impact: TicketImpact, urgency: TicketUrgency): Priority {
  const matrix: Record<TicketImpact, Record<TicketUrgency, Priority>> = {
    high: { high: "urgent", medium: "high", low: "medium" },
    medium: { high: "high", medium: "medium", low: "low" },
    low: { high: "medium", medium: "low", low: "low" }
  };
  return matrix[impact][urgency];
}

export function needsTicketPriorityReview(ticket: Ticket) {
  return !ticket.priority_reviewed_at
    && (ticket.reported_impact === "high" || ticket.reported_urgency === "high");
}

export function getTicketSlaIndicators(ticket: Ticket, policies: TicketSlaPolicy[], now = Date.now()) {
  if (ticket.ccg_request_type) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const priorityGroup = ticket.priority === "high" || ticket.priority === "urgent" ? "high" : "standard";
  const policy = policies.find((item) => item.priority_group === priorityGroup);
  const slaStartedAt = ticket.reopened_at ?? ticket.created_at;
  if (!policy || !slaStartedAt) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const createdAt = Date.parse(slaStartedAt);
  if (!Number.isFinite(createdAt)) return [];
  const indicators: Array<{ key: string; label: string; state: "warning" | "breached" }> = [];
  const holidays = getSlaHolidayDates(policies);
  const responseDeadline = addBusinessDays(createdAt, policy.first_response_business_days, holidays);
  const finalStates = ["resolved", "closed", "rejected"];
  const responseAt = ticket.first_response_at
    ?? (finalStates.includes(ticket.status) ? ticket.resolved_at : null);
  const responseAtRisk = addBusinessSeconds(
    createdAt,
    policy.first_response_business_days * officeDaySeconds * 0.75,
    holidays
  );
  if (responseAt) {
    if (Date.parse(responseAt) > responseDeadline) indicators.push({ key: "response", label: "Response SLA missed", state: "breached" });
  } else if (!finalStates.includes(ticket.status) && now > responseDeadline) {
    indicators.push({ key: "response", label: "Response SLA overdue", state: "breached" });
  } else if (!finalStates.includes(ticket.status) && now >= responseAtRisk) {
    indicators.push({ key: "response", label: "Response due soon", state: "warning" });
  }

  const resolutionDeadline = addBusinessDays(createdAt, policy.resolution_business_days, holidays);
  const resolutionAtRisk = addBusinessSeconds(
    createdAt,
    policy.resolution_business_days * officeDaySeconds * 0.75,
    holidays
  );
  if (ticket.resolved_at) {
    if (Date.parse(ticket.resolved_at) > resolutionDeadline) indicators.push({ key: "resolution", label: "Resolution SLA missed", state: "breached" });
  } else if (now > resolutionDeadline && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution SLA overdue", state: "breached" });
  } else if (now >= resolutionAtRisk && !finalStates.includes(ticket.status)) {
    indicators.push({ key: "resolution", label: "Resolution due soon", state: "warning" });
  }
  return indicators;
}

export function getCcgDeadlineIndicators(ticket: Ticket, now = Date.now()) {
  if (!ticket.ccg_request_type || ["resolved", "closed", "rejected"].includes(ticket.status)) return [] as Array<{ key: string; label: string; state: "warning" | "breached" }>;
  const indicators: Array<{ key: string; label: string; state: "warning" | "breached" }> = [];
  const stageDue = Date.parse(ticket.ccg_stage_due_at ?? "");
  if (Number.isFinite(stageDue) && ticket.status !== "waiting_for_info") {
    if (now >= stageDue) indicators.push({ key: "ccg-stage", label: "CCG response overdue", state: "breached" });
    else if (stageDue - now <= 8 * 60 * 60 * 1000) indicators.push({ key: "ccg-stage", label: "CCG response due soon", state: "warning" });
  }
  const vendorDue = Date.parse(ticket.ccg_vendor_due_at ?? "");
  if (Number.isFinite(vendorDue) && ticket.ccg_followup_status === "pending") {
    if (now >= vendorDue) indicators.push({ key: "ccg-vendor", label: "Vendor response overdue · CCG clock paused", state: "warning" });
    else if (vendorDue - now <= 7 * 24 * 60 * 60 * 1000) indicators.push({ key: "ccg-vendor", label: "Vendor response due within a week", state: "warning" });
  }
  return indicators;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en", {
    timeZone: appTimeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

export function titleCase(value?: string | null) {
  if (!value) return "Unassigned";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatTicketCount(count: number) {
  return `${count} ${count === 1 ? "ticket" : "tickets"}`;
}
