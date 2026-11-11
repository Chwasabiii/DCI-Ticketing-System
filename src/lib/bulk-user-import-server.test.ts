import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import ExcelJS from "exceljs";
import { createBulkUserTemplate, parseBulkUserFile } from "./bulk-user-import-server";
import type { EmployeeRole, ServiceTeam } from "./types";

const teams: ServiceTeam[] = [{
  id: 1,
  name: "IT Support Department",
  slug: "it-support",
  is_in_scope: true,
  is_active: true
}];
const roles: EmployeeRole[] = ["Coordinator", "Personnel", "Manager"];

describe("bulk user import workbook handling", () => {
  it("generates a dropdown-enabled template and parses its rows", async () => {
    const workbookBuffer = await createBulkUserTemplate(teams, roles);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);
    const worksheet = workbook.getWorksheet("Users");
    expect(worksheet?.getCell("C2").dataValidation.formulae).toEqual(["=AccountTypes"]);
    expect(worksheet?.getCell("D2").dataValidation.formulae).toEqual(["=Departments"]);

    const file = new File([new Uint8Array(workbookBuffer)], "users.xlsx");
    const rows = await parseBulkUserFile(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      email: "alex.user@example.com",
      role: "End user"
    });
    expect(rows[1]).toMatchObject({
      email: "jordan.provider@example.com",
      department: "IT Support Department",
      provider_roles: "Personnel"
    });
  });

  it("rejects Excel formula cells without evaluating their values", async () => {
    const workbookBuffer = await createBulkUserTemplate(teams, roles);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);
    const worksheet = workbook.getWorksheet("Users");
    if (!worksheet) throw new Error("Template worksheet was not created.");
    worksheet.getCell("A2").value = { formula: "1+1" };
    const formulaBuffer = await workbook.xlsx.writeBuffer();
    const rows = await parseBulkUserFile(new File([new Uint8Array(formulaBuffer)], "formula.xlsx"));
    expect(rows[0].email).toBe("");
    expect(rows[0].formulaFields).toContain("email");
  });

  it("parses CSV files with a header row", async () => {
    const csv = [
      "email,full_name,role,department,provider_roles",
      "alex@example.com,Alex Example,End user,,"
    ].join("\r\n");
    const rows = await parseBulkUserFile(new File([csv], "users.csv"));
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("alex@example.com");
  });
});
