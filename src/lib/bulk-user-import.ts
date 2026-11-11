import type { EmployeeRole, ServiceTeam, UserSide } from "@/lib/types";

export const MAX_BULK_USER_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_BULK_USER_ROWS = 500;

export type BulkAccountType = "End user" | "Service provider" | "Admin";

export type BulkUserInputRow = {
  rowNumber: number;
  email: string;
  full_name: string;
  role: string;
  department: string;
  provider_roles: string;
  formulaFields?: string[];
};

export type BulkUserStatus = "ready" | "error" | "already_exists" | "invited" | "failed" | "skipped";

export type BulkUserPreviewRow = BulkUserInputRow & {
  user_side: UserSide | null;
  service_team_id: number | null;
  service_team_name: string | null;
  employee_roles: EmployeeRole[];
  status: "ready" | "error" | "already_exists";
  errors: string[];
};

export type BulkUserResultRow = BulkUserInputRow & {
  status: "invited" | "failed" | "skipped";
  reason: string;
};

export function getBulkUploadFileError(fileName: string, fileSize: number) {
  const extension = fileName.toLocaleLowerCase().split(".").pop();
  if (extension !== "xlsx" && extension !== "csv") {
    return "Choose an .xlsx or .csv file.";
  }
  if (fileSize <= 0) return "The selected file is empty.";
  if (fileSize > MAX_BULK_USER_FILE_BYTES) return "The file exceeds the 2 MB limit.";
  return null;
}

function isFormulaLike(value: string) {
  return /^[=+\-@]/.test(value.trimStart());
}

function normalizeAccountType(value: string): UserSide | null {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "end user" || normalized === "client") return "client";
  if (normalized === "service provider" || normalized === "employee") return "employee";
  if (normalized === "admin" || normalized === "administrator") return "admin";
  return null;
}

function matchProviderRoles(value: string, allowedRoles: EmployeeRole[]) {
  const roleNames = value.split(";").map((role) => role.trim()).filter(Boolean);
  const matched: EmployeeRole[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const roleName of roleNames) {
    const key = roleName.toLocaleLowerCase();
    if (seen.has(key)) {
      errors.push(`Duplicate provider role: ${roleName}.`);
      continue;
    }
    seen.add(key);
    const match = allowedRoles.find((role) => role.toLocaleLowerCase() === key);
    if (!match) errors.push(`Unknown provider role: ${roleName}.`);
    else matched.push(match);
  }

  return { matched, errors };
}

export function validateBulkUserRows(
  rows: BulkUserInputRow[],
  options: { teams: ServiceTeam[]; roles: EmployeeRole[]; existingEmails?: Set<string> }
): BulkUserPreviewRow[] {
  const emailCounts = new Map<string, number>();
  for (const row of rows) {
    const email = row.email.trim().toLocaleLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  return rows.map((row) => {
    const email = row.email.trim().toLocaleLowerCase();
    const fullName = row.full_name.trim();
    const accountType = normalizeAccountType(row.role);
    const errors = [...(row.formulaFields ?? []).map((field) => `Formula cell not allowed: ${field}.`)];
    for (const [field, value] of [
      ["email", row.email],
      ["full_name", row.full_name],
      ["role", row.role],
      ["department", row.department],
      ["provider_roles", row.provider_roles]
    ] as const) {
      if (isFormulaLike(value)) errors.push(`${field} must be plain text, not a formula-like value.`);
    }

    if (!email) errors.push("Email is required.");
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Enter a valid email address.");
    }
    if (email && emailCounts.get(email)! > 1) errors.push("Duplicate email in this file.");
    if (!fullName) errors.push("Full name is required.");
    else if (fullName.length > 200) errors.push("Full name must be 200 characters or fewer.");
    if (!accountType) errors.push("Role must be End user, Service provider, or Admin.");

    let serviceTeam: ServiceTeam | undefined;
    let employeeRoles: EmployeeRole[] = [];
    if (accountType === "employee") {
      if (!row.department.trim()) errors.push("Department is required for service providers.");
      else {
        serviceTeam = options.teams.find((team) =>
          team.name.toLocaleLowerCase() === row.department.trim().toLocaleLowerCase()
          || team.slug.toLocaleLowerCase() === row.department.trim().toLocaleLowerCase()
        );
        if (!serviceTeam) errors.push(`Unknown department: ${row.department.trim()}.`);
      }

      const parsedRoles = matchProviderRoles(row.provider_roles, options.roles);
      employeeRoles = parsedRoles.matched;
      errors.push(...parsedRoles.errors);
      if (employeeRoles.length === 0) errors.push("At least one provider role is required.");
    } else if (row.department.trim()) {
      errors.push("Department must be blank for end users and admins.");
    } else if (row.provider_roles.trim()) {
      errors.push("Provider roles must be blank for end users and admins.");
    }

    const alreadyExists = Boolean(email && options.existingEmails?.has(email));
    if (alreadyExists) errors.push("Already exists.");

    const status = errors.some((error) => error !== "Already exists.")
      ? "error"
      : alreadyExists ? "already_exists" : "ready";

    return {
      ...row,
      email,
      full_name: fullName,
      user_side: accountType,
      service_team_id: serviceTeam?.id ?? null,
      service_team_name: serviceTeam?.name ?? null,
      employee_roles: employeeRoles,
      status,
      errors
    };
  });
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function toCsv(rows: Array<Array<unknown>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
