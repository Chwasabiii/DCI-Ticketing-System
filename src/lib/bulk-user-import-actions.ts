"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/site-url";
import { parseBulkUserFile } from "@/lib/bulk-user-import-server";
import {
  validateBulkUserRows,
  type BulkUserInputRow,
  type BulkUserResultRow
} from "@/lib/bulk-user-import";
import type { EmployeeRole, ServiceTeam } from "@/lib/types";

const providerRoles: EmployeeRole[] = ["Coordinator", "Personnel", "Manager"];
const accountTypes = ["client", "employee", "admin"] as const;
const batchSize = 10;
const allowedInputFields = ["email", "full_name", "role", "department", "provider_roles"];
const maxLengthByField: Record<string, number> = {
  email: 320,
  full_name: 500,
  role: 100,
  department: 200,
  provider_roles: 500
};

type RoleRecord = { id: number; name: EmployeeRole };
type BulkAdminContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; adminClient: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string };

async function getBulkAdminContext(): Promise<BulkAdminContext> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sign in as an administrator to import users." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_side, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.user_side !== "admin" || profile.status !== "active") {
    return { ok: false, error: "Only active administrators can import users." };
  }

  try {
    return { ok: true, supabase, adminClient: createAdminClient() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The Supabase Admin API is not configured."
    };
  }
}

async function getImportOptions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [teamResult, roleResult] = await Promise.all([
    supabase.from("service_teams")
      .select("id, name, slug, is_in_scope, is_active")
      .eq("is_active", true)
      .order("name")
      .returns<ServiceTeam[]>(),
    supabase.from("roles")
      .select("id, name")
      .in("name", providerRoles)
      .order("name")
      .returns<RoleRecord[]>()
  ]);
  if (teamResult.error) throw new Error(`Could not load service teams: ${teamResult.error.message}`);
  if (roleResult.error) throw new Error(`Could not load provider roles: ${roleResult.error.message}`);

  const roles = (roleResult.data ?? []).map((role) => role.name);
  if (roles.length !== providerRoles.length) {
    throw new Error("The configured provider roles do not match the roles supported by the current invitation flow.");
  }
  return { teams: teamResult.data ?? [], roles };
}

async function getExistingEmails(
  adminClient: ReturnType<typeof createAdminClient>,
  emails: string[]
) {
  const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLocaleLowerCase()).filter(Boolean))];
  if (!uniqueEmails.length) return new Set<string>();
  const { data, error } = await adminClient.from("profiles").select("email").in("email", uniqueEmails);
  if (error) throw new Error(`Could not check existing accounts: ${error.message}`);
  return new Set((data ?? []).flatMap((profile) => profile.email ? [profile.email.trim().toLocaleLowerCase()] : []));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseClientRows(value: unknown): BulkUserInputRow[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > batchSize) return null;
  const result: BulkUserInputRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (!Number.isInteger(row.rowNumber) || (row.rowNumber as number) < 2 || (row.rowNumber as number) > 1_048_576) return null;
    if (!allowedInputFields.every((key) => typeof row[key] === "string")) return null;
    if (allowedInputFields.some((key) => (row[key] as string).length > maxLengthByField[key])) return null;
    const formulaFields = row.formulaFields;
    if (formulaFields !== undefined
      && (!Array.isArray(formulaFields)
        || formulaFields.length > allowedInputFields.length
        || formulaFields.some((field) => typeof field !== "string" || !allowedInputFields.includes(field)))) return null;
    result.push({
      rowNumber: row.rowNumber as number,
      email: row.email as string,
      full_name: row.full_name as string,
      role: row.role as string,
      department: row.department as string,
      provider_roles: row.provider_roles as string,
      formulaFields: formulaFields as string[] | undefined
    });
  }
  return result;
}

async function recordItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
  email: string,
  status: "invited" | "failed" | "skipped",
  reason: string
) {
  const { error } = await supabase.rpc("record_bulk_user_import_item", {
    p_run_id: runId,
    p_email: email,
    p_status: status,
    p_reason: reason
  });
  if (error) throw new Error(`The result could not be written to the import audit log: ${error.message}`);
}

function toResult(row: BulkUserInputRow, status: BulkUserResultRow["status"], reason: string): BulkUserResultRow {
  return {
    rowNumber: row.rowNumber,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    department: row.department,
    provider_roles: row.provider_roles,
    formulaFields: row.formulaFields,
    status,
    reason
  };
}

export async function validateBulkUserImport(formData: FormData) {
  const context = await getBulkAdminContext();
  if (!context.ok) return { error: context.error };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an .xlsx or .csv file to upload." };

  try {
    const rawRows = await parseBulkUserFile(file);
    const { teams, roles } = await getImportOptions(context.supabase);
    const existingEmails = await getExistingEmails(context.adminClient, rawRows.map((row) => row.email));
    const rows = validateBulkUserRows(rawRows, { teams, roles, existingEmails });
    const summary = {
      ready: rows.filter((row) => row.status === "ready").length,
      errors: rows.filter((row) => row.status === "error").length,
      alreadyExists: rows.filter((row) => row.status === "already_exists").length
    };
    return { fileName: file.name.slice(0, 255), rows, summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The file could not be validated." };
  }
}

export async function startBulkUserImport(fileName: string, totalRows: number) {
  const context = await getBulkAdminContext();
  if (!context.ok) return { error: context.error };
  if (typeof fileName !== "string" || fileName.trim().length === 0 || !Number.isInteger(totalRows) || totalRows < 1 || totalRows > 500) {
    return { error: "The import details are invalid. Upload and review the file again." };
  }

  const { data, error } = await context.supabase.rpc("start_bulk_user_import", {
    p_file_name: fileName.slice(0, 255),
    p_total_rows: totalRows
  });
  if (error) return { error: `Could not start the import: ${error.message}` };
  if (typeof data !== "string" || !isUuid(data)) {
    return { error: "The audit database returned an invalid import ID." };
  }
  return { runId: data };
}

export async function processBulkUserImportBatch(runId: string, untrustedRows: unknown) {
  const context = await getBulkAdminContext();
  if (!context.ok) return { error: context.error };
  if (!isUuid(runId)) return { error: "The import run is invalid." };
  const rows = parseClientRows(untrustedRows);
  if (!rows) return { error: `Submit between 1 and ${batchSize} valid rows per batch.` };

  let options: Awaited<ReturnType<typeof getImportOptions>>;
  let existingEmails: Set<string>;
  try {
    options = await getImportOptions(context.supabase);
    existingEmails = await getExistingEmails(context.adminClient, rows.map((row) => row.email));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not re-validate this batch." };
  }

  const validation = validateBulkUserRows(rows, { teams: options.teams, roles: options.roles, existingEmails });
  const results: BulkUserResultRow[] = [];
  const roleNames = [...new Set(validation.flatMap((row) => row.employee_roles))];
  const roleIdByName = new Map<EmployeeRole, number>();
  if (roleNames.length) {
    const { data: roleRows, error } = await context.adminClient
      .from("roles")
      .select("id, name")
      .in("name", roleNames)
      .returns<RoleRecord[]>();
    if (error) return { error: `Could not reload provider roles: ${error.message}` };
    for (const role of roleRows ?? []) roleIdByName.set(role.name, role.id);
  }

  let siteUrl: string;
  try {
    siteUrl = getSiteOrigin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invitation URL configuration is invalid." };
  }

  for (const [rowIndex, row] of validation.entries()) {
    if (row.status === "error" && row.errors.some((message) =>
      message === "Duplicate email in this file." || message === "Email is required."
    )) {
      results.push(toResult(row, "failed", row.errors.join(" ")));
      continue;
    }

    const { data: claimed, error: claimError } = await context.supabase.rpc("claim_bulk_user_import_item", {
      p_run_id: runId,
      p_email: row.email
    });
    if (claimError) {
      results.push(toResult(row, "failed", `Could not claim this row for processing: ${claimError.message}`));
      continue;
    }
    if (claimed !== true) {
      results.push(toResult(row, "skipped", "This email was already processed in this import run; no second invitation was sent."));
      continue;
    }

    if (row.status === "error") {
      const reason = row.errors.join(" ");
      try {
        await recordItem(context.supabase, runId, row.email, "failed", reason);
      } catch (error) {
        results.push(toResult(row, "failed", `${reason} ${error instanceof Error ? error.message : ""}`.trim()));
        continue;
      }
      results.push(toResult(row, "failed", reason));
      continue;
    }

    if (row.status === "already_exists") {
      const reason = "Already exists in the system.";
      try {
        await recordItem(context.supabase, runId, row.email, "skipped", reason);
      } catch (error) {
        results.push(toResult(row, "failed", error instanceof Error ? error.message : reason));
        continue;
      }
      results.push(toResult(row, "skipped", reason));
      continue;
    }

    const userSide = row.user_side;
    if (!userSide || !accountTypes.includes(userSide)) {
      const reason = "The account type could not be validated.";
      try {
        await recordItem(context.supabase, runId, row.email, "failed", reason);
      } catch (error) {
        results.push(toResult(row, "failed", `${reason} ${error instanceof Error ? error.message : ""}`.trim()));
        continue;
      }
      results.push(toResult(row, "failed", reason));
      continue;
    }
    const roleIds = row.employee_roles.map((role) => roleIdByName.get(role));
    if (userSide === "employee" && roleIds.some((id) => !id)) {
      const reason = "One or more provider roles are not configured.";
      try {
        await recordItem(context.supabase, runId, row.email, "failed", reason);
      } catch (error) {
        results.push(toResult(row, "failed", `${reason} ${error instanceof Error ? error.message : ""}`.trim()));
        continue;
      }
      results.push(toResult(row, "failed", reason));
      continue;
    }

    let createdUserId: string | null = null;
    let resultStatus: BulkUserResultRow["status"] = "failed";
    let resultReason = "The invitation could not be sent.";
    try {
      const { data: invitation, error: inviteError } = await context.adminClient.auth.admin.inviteUserByEmail(row.email, {
        data: { full_name: row.full_name },
        redirectTo: `${siteUrl}/auth/callback`
      });
      if (inviteError) {
        if (/already registered|already exists|user exists/i.test(inviteError.message)) {
          resultStatus = "skipped";
          resultReason = "Already exists in the authentication system.";
        } else {
          resultReason = inviteError.message;
        }
      } else if (!invitation.user) {
        resultReason = "Supabase did not return the invited user record.";
      } else {
        const invitedUserId = invitation.user.id;
        createdUserId = invitedUserId;
        const { data: updatedProfile, error: profileError } = await context.adminClient
          .from("profiles")
          .update({
            full_name: row.full_name,
            email: row.email,
            user_side: userSide,
            service_team_id: row.service_team_id,
            status: "active",
            invitation_pending: true
          })
          .eq("id", invitedUserId)
          .select("id")
          .maybeSingle();
        if (profileError || !updatedProfile) {
          throw new Error(`Could not set up the user profile: ${profileError?.message ?? "profile row was not created by the Auth trigger"}`);
        }

        if (userSide === "employee") {
          const userRoleRows = row.employee_roles.map((role) => {
            const roleId = roleIdByName.get(role);
            if (roleId === undefined) throw new Error(`Provider role ${role} is not configured.`);
            return { user_id: invitedUserId, role_id: roleId };
          });
          const { error: rolesError } = await context.adminClient.from("user_roles").insert(userRoleRows);
          if (rolesError) throw new Error(`Could not assign provider roles: ${rolesError.message}`);
        }
        resultStatus = "invited";
        resultReason = "Invitation email sent.";
      }
    } catch (error) {
      resultReason = error instanceof Error ? error.message : "An unexpected error occurred.";
    }

    if (resultStatus === "failed" && createdUserId) {
      try {
        const { error: cleanupError } = await context.adminClient.auth.admin.deleteUser(createdUserId);
        resultReason += cleanupError
          ? ` Cleanup failed; the user record may still exist: ${cleanupError.message}`
          : " The incomplete user record was removed.";
      } catch (error) {
        resultReason += ` Cleanup failed; the user record may still exist: ${error instanceof Error ? error.message : "unknown API error"}`;
      }
    }

    try {
      await recordItem(context.supabase, runId, row.email, resultStatus, resultReason);
    } catch (error) {
      resultStatus = "failed";
      resultReason = `${resultReason} Invitation processing finished, but audit logging failed: ${error instanceof Error ? error.message : "unknown audit error"}`;
    }
    results.push(toResult(row, resultStatus, resultReason));
    if (rowIndex < validation.length - 1) await new Promise((resolve) => setTimeout(resolve, 300));
  }

  revalidatePath("/admin/users");
  return { results };
}

export async function finishBulkUserImport(runId: string) {
  const context = await getBulkAdminContext();
  if (!context.ok) return { error: context.error };
  if (!isUuid(runId)) return { error: "The import run is invalid." };
  const { data, error } = await context.supabase.rpc("finish_bulk_user_import", { p_run_id: runId });
  if (error) return { error: `Could not finish the import audit: ${error.message}` };
  const counts = Array.isArray(data) ? data[0] : null;
  if (!counts || typeof counts !== "object") return { error: "The audit database returned an invalid result." };
  revalidatePath("/admin/users");
  return { success: true };
}
