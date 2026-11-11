import "server-only";

import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { EmployeeRole, ServiceTeam } from "./types";
import {
  getBulkUploadFileError,
  MAX_BULK_USER_ROWS,
  type BulkUserInputRow
} from "./bulk-user-import";

const templateHeaders = ["email", "full_name", "role", "department", "provider_roles"];

function cellText(cell: ExcelJS.Cell, formulaFields: string[], field: string) {
  const value = cell.value;
  if (cell.type === ExcelJS.ValueType.Formula
    || (value !== null && typeof value === "object" && "formula" in value)) {
    formulaFields.push(field);
    return "";
  }
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if ("richText" in value) return value.richText.map((item) => item.text).join("").trim();
  if ("text" in value && typeof value.text === "string") return value.text.trim();
  return "";
}

function canonicalHeader(value: string) {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/g, "_");
}

export async function parseBulkUserFile(file: File): Promise<BulkUserInputRow[]> {
  const fileError = getBulkUploadFileError(file.name, file.size);
  if (fileError) throw new Error(fileError);

  const fileBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  const extension = file.name.toLocaleLowerCase().split(".").pop();
  if (extension === "xlsx") {
    const signature = new Uint8Array(fileBuffer);
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
      throw new Error("The .xlsx file is not a valid Excel workbook.");
    }
    await workbook.xlsx.load(fileBuffer);
  } else {
    await workbook.csv.read(Readable.from([Buffer.from(fileBuffer)]));
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The file does not contain a worksheet.");
  if (worksheet.actualRowCount > MAX_BULK_USER_ROWS + 1) {
    throw new Error(`The file contains more than ${MAX_BULK_USER_ROWS} user rows. Upload no more than ${MAX_BULK_USER_ROWS} user rows.`);
  }
  const headerRow = worksheet.getRow(1);
  const headers = templateHeaders.map((expected) => {
    let found = 0;
    headerRow.eachCell({ includeEmpty: false }, (cell, column) => {
      if (canonicalHeader(cellText(cell, [], expected)) === expected) found = column;
    });
    return found;
  });
  if (headers.some((column) => column === 0)) {
    throw new Error(`Include these columns in the header row: ${templateHeaders.join(", ")}.`);
  }

  const columnNames = new Map(headers.map((column, index) => [column, templateHeaders[index]]));
  const parsedRows: BulkUserInputRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const formulaFields: string[] = [];
    const values: Record<string, string> = {};
    for (const [column, name] of columnNames) {
      values[name] = cellText(row.getCell(column), formulaFields, name);
    }
    if (!templateHeaders.some((header) => values[header])) return;
    parsedRows.push({
      rowNumber,
      email: values.email ?? "",
      full_name: values.full_name ?? "",
      role: values.role ?? "",
      department: values.department ?? "",
      provider_roles: values.provider_roles ?? "",
      formulaFields
    });
  });

  if (parsedRows.length === 0) throw new Error("The file has no user rows.");
  if (parsedRows.length > MAX_BULK_USER_ROWS) {
    throw new Error(`The file contains ${parsedRows.length} rows. Upload no more than ${MAX_BULK_USER_ROWS} user rows.`);
  }
  return parsedRows;
}

function excelColumn(column: number) {
  let result = "";
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

export async function createBulkUserTemplate(teams: ServiceTeam[], roles: EmployeeRole[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMSG Desk";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Users");
  worksheet.columns = [
    { header: "email", key: "email", width: 32 },
    { header: "full_name", key: "full_name", width: 28 },
    { header: "role", key: "role", width: 22 },
    { header: "department", key: "department", width: 32 },
    { header: "provider_roles", key: "provider_roles", width: 34 }
  ];
  worksheet.addRow({
    email: "alex.user@example.com",
    full_name: "Alex Example",
    role: "End user",
    department: "",
    provider_roles: ""
  });
  worksheet.addRow({
    email: "jordan.provider@example.com",
    full_name: "Jordan Example",
    role: "Service provider",
    department: teams.find((team) => team.slug === "it-support")?.name ?? "",
    provider_roles: roles.includes("Personnel") ? "Personnel" : roles[0] ?? ""
  });
  worksheet.autoFilter = { from: "A1", to: "E1" };
  worksheet.getRow(1).font = { bold: true };
  worksheet.getCell("E1").note = "For service providers, list one or more provider roles separated by semicolons. Leave blank for end users and admins.";
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const optionsSheet = workbook.addWorksheet("Options");
  optionsSheet.state = "hidden";
  ["Account types", "Departments"].forEach((header, index) => {
    optionsSheet.getCell(1, index + 1).value = header;
  });
  ["End user", "Service provider", "Admin"].forEach((value, index) => {
    optionsSheet.getCell(index + 2, 1).value = value;
  });
  teams.forEach((team, index) => {
    optionsSheet.getCell(index + 2, 2).value = team.name;
  });
  workbook.definedNames.add("'Options'!$A$2:$A$4", "AccountTypes");
  if (teams.length) {
    workbook.definedNames.add(`'Options'!$B$2:$B$${teams.length + 1}`, "Departments");
  }

  for (let rowNumber = 2; rowNumber <= MAX_BULK_USER_ROWS + 1; rowNumber += 1) {
    worksheet.getCell(`${excelColumn(3)}${rowNumber}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["=AccountTypes"],
      showErrorMessage: true,
      errorTitle: "Choose an account type",
      error: "Select an account type from the list."
    };
    if (teams.length) {
      worksheet.getCell(`${excelColumn(4)}${rowNumber}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["=Departments"],
        showErrorMessage: true,
        errorTitle: "Choose a department",
        error: "Select a department from the list."
      };
    }
  }

  return workbook.xlsx.writeBuffer();
}
