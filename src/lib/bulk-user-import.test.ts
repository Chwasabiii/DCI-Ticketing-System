import { describe, expect, it } from "vitest";
import {
  getBulkUploadFileError,
  MAX_BULK_USER_FILE_BYTES,
  validateBulkUserRows,
  type BulkUserInputRow
} from "./bulk-user-import";
import type { EmployeeRole, ServiceTeam } from "./types";

const teams: ServiceTeam[] = [{
  id: 1,
  name: "IT Support Department",
  slug: "it-support",
  is_in_scope: true,
  is_active: true
}];
const roles: EmployeeRole[] = ["Coordinator", "Personnel", "Manager"];

function row(overrides: Partial<BulkUserInputRow> = {}): BulkUserInputRow {
  return {
    rowNumber: 2,
    email: "alex@example.com",
    full_name: "Alex Example",
    role: "End user",
    department: "",
    provider_roles: "",
    ...overrides
  };
}

function validate(rows: BulkUserInputRow[], existingEmails?: Set<string>) {
  return validateBulkUserRows(rows, { teams, roles, existingEmails });
}

describe("validateBulkUserRows", () => {
  it("normalizes valid email and name values", () => {
    const [result] = validate([row({ email: "  Alex@Example.com ", full_name: " Alex Example " })]);
    expect(result.status).toBe("ready");
    expect(result.email).toBe("alex@example.com");
    expect(result.full_name).toBe("Alex Example");
  });

  it("rejects malformed email addresses", () => {
    const [result] = validate([row({ email: "not-an-email" })]);
    expect(result.status).toBe("error");
    expect(result.errors).toContain("Enter a valid email address.");
  });

  it("marks every duplicate email in the file", () => {
    const [first, second] = validate([
      row({ email: "alex@example.com" }),
      row({ rowNumber: 3, email: " Alex@Example.com " })
    ]);
    expect(first.errors).toContain("Duplicate email in this file.");
    expect(second.errors).toContain("Duplicate email in this file.");
    expect(first.status).toBe("error");
    expect(second.status).toBe("error");
  });

  it("rejects unknown account types and provider roles", () => {
    const [unknownAccount] = validate([row({ role: "superuser" })]);
    const [unknownProviderRole] = validate([row({
      role: "Service provider",
      department: "IT Support Department",
      provider_roles: "Administrator"
    })]);
    expect(unknownAccount.errors).toContain("Role must be End user, Service provider, or Admin.");
    expect(unknownProviderRole.errors).toContain("Unknown provider role: Administrator.");
  });

  it("requires a real department and at least one provider role for providers", () => {
    const [missingDepartment] = validate([row({ role: "Service provider", provider_roles: "Personnel" })]);
    const [unknownDepartment] = validate([row({
      role: "Service provider",
      department: "Not a department",
      provider_roles: "Personnel"
    })]);
    const [missingRole] = validate([row({ role: "Service provider", department: "IT Support Department" })]);
    expect(missingDepartment.errors).toContain("Department is required for service providers.");
    expect(unknownDepartment.errors).toContain("Unknown department: Not a department.");
    expect(missingRole.errors).toContain("At least one provider role is required.");
  });

  it("rejects formula-like cells and workbook formula values", () => {
    const [formulaInput] = validate([row({ full_name: "=HYPERLINK(\"https://example.com\")" })]);
    const [formulaCell] = validate([row({ formulaFields: ["email"] })]);
    expect(formulaInput.status).toBe("error");
    expect(formulaInput.errors).toContain("full_name must be plain text, not a formula-like value.");
    expect(formulaCell.errors).toContain("Formula cell not allowed: email.");
  });

  it("marks registered emails as already existing", () => {
    const [result] = validate([row()], new Set(["alex@example.com"]));
    expect(result.status).toBe("already_exists");
    expect(result.errors).toContain("Already exists.");
  });
});

describe("getBulkUploadFileError", () => {
  it("accepts non-empty xlsx and csv files under the limit", () => {
    expect(getBulkUploadFileError("users.xlsx", 100)).toBeNull();
    expect(getBulkUploadFileError("users.CSV", 100)).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(getBulkUploadFileError("users.xls", 100)).toBe("Choose an .xlsx or .csv file.");
    expect(getBulkUploadFileError("users.csv", 0)).toBe("The selected file is empty.");
    expect(getBulkUploadFileError("users.xlsx", MAX_BULK_USER_FILE_BYTES + 1)).toBe("The file exceeds the 2 MB limit.");
  });
});
