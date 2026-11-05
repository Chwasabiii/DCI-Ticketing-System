# Production operations

## Backups

### Choose a backup method

- **Paid Supabase plan:** In the project dashboard, check **Database > Backups** and confirm the schedule and retention meet your recovery needs. Daily database backups are available on Pro, Team, and Enterprise plans; PITR is a paid add-on. A database restore causes downtime, so use a separate project for restore practice.
- **Free plan or an independent copy:** Install the Supabase CLI and Docker Desktop, authenticate with `supabase login`, then link the project with `supabase link --project-ref YOUR_PROJECT_REF`. The CLI prompts for the database password. From the repository root, create a dated backup folder outside the repo and run:

  ```powershell
  $backupDir = Join-Path $env:USERPROFILE ("supabase-backups\pmsg-desk\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  supabase db dump --linked --role-only --file (Join-Path $backupDir "roles.sql")
  supabase db dump --linked --file (Join-Path $backupDir "schema.sql")
  supabase db dump --linked --data-only --use-copy `
    --exclude "storage.buckets_vectors" --exclude "storage.vector_indexes" `
    --file (Join-Path $backupDir "data.sql")
  ```

  Protect the export as sensitive data: it may contain user emails and ticket content. Encrypt it and copy it to access-controlled storage outside this computer. Do not commit dumps or credentials to Git. **This CLI export excludes Supabase-managed `auth` and `storage` schemas and does not include Storage file objects or Auth identities.** It is useful for recovering this app's public database schema and data, but a full account and attachment recovery needs a separate plan for Auth and Storage.

### Practice a restore

1. Create a separate, temporary Supabase project for the drill. Never test a restore against production. Install PostgreSQL command-line tools (`psql`) and get the temporary project's connection string from its **Connect** panel.
2. Restore the three SQL exports into that empty project. Use a secure environment variable or password manager for the connection string; do not put database passwords directly into scripts or source control. The command order is roles, schema, then data:

   ```powershell
   psql --single-transaction --set ON_ERROR_STOP=1 `
     --file (Join-Path $backupDir "roles.sql") `
     --file (Join-Path $backupDir "schema.sql") `
     --command "SET session_replication_role = replica" `
     --file (Join-Path $backupDir "data.sql") `
     --dbname $env:RESTORE_DB_URL
   ```

   Set `RESTORE_DB_URL` only in the current PowerShell session from a secure source. Supabase's CLI restore guide notes that platform-managed schemas/settings and some customizations may need separate handling; this drill is to validate this app's database dump, not to create a production replacement automatically.
3. Verify the restore in the temporary project's SQL Editor: expected app tables and functions exist; `profiles`, `tickets`, and ticket activity have plausible row counts; RLS is enabled on app tables. Create a temporary test Auth user and corresponding profile, then sign into a staging copy of the app and check a requester and employee workflow. The CLI exports described above do not restore production Auth users/passwords.
4. Storage files require a separate backup because database exports do not include Storage objects (and the CLI dump excludes the managed Storage schema). Back up and restore the `ticket-attachments` bucket separately using an S3-compatible client or Supabase Storage tools, then verify that a sample attachment downloads in the test project.
5. Record the backup date, restore date, elapsed restore time, checks passed/failed, and the person doing the drill. Repeat at least quarterly and after changing backup tooling. Delete the temporary project and securely remove local plaintext exports when the exercise is complete.

Before every production migration, take a fresh backup/export and record its timestamp, the migration, and the operator. Supabase documents its current plan-specific backup retention and restore behavior in the [Database Backups guide](https://supabase.com/docs/guides/platform/backups); check that guide and your dashboard because plan features can change.

## Applying migrations

1. Review the SQL diff and confirm it is additive or has an approved rollback plan. Do not edit or re-run `supabase/schema.sql` on an existing production database; it is the initial schema for a fresh project.
2. Take a backup/export and apply migrations to a staging Supabase project first.
3. Apply each unapplied file in `supabase/migrations/` once, in filename order, using the Supabase SQL Editor or the team's approved migration runner. Keep a record of each applied migration; the SQL files are not an automatic deployment mechanism.
4. Apply migrations once in filename order. After migrations through `20261031`, apply `20261105_remove_project_and_routing_workflows.sql` to disable project approvals and automatic routing while retaining stored records. Then apply `20261106_service_teams.sql` to create the service team directory, assign existing providers and tickets to IT Support, and enforce team-scoped access for providers. Apply `20261107_end_users_only_ticket_creation.sql` to restrict ticket creation to end users at the database level, then `20261108_team_faq_management.sql` to let IT Support and Cost Control Group providers manage FAQs for their own teams.
5. After each migration, inspect SQL Editor errors, verify the changed tables/functions/policies, and perform role-based smoke checks in staging. Confirm requesters cannot read internal notes or other users' tickets, and that employees/admins retain only their intended access.
6. Apply to production during an agreed maintenance window, then verify the dashboard, ticket activity, notification settings, and reports. If a migration fails partway, stop and inspect database state before retrying; do not blindly re-run SQL.

## Error monitoring

- Review Supabase **Logs Explorer** for database, Auth, Storage, and Edge Function errors after releases and during support incidents.
- Capture the Next.js server process's stdout/stderr in the hosting platform's log service. Alert on repeated server errors, failed deployments, and unavailable health checks.
- Keep log retention and access limited to the people who operate the system. Avoid logging access tokens, SMTP credentials, service-role keys, or ticket/comment contents.
- If an external error tracker is adopted, configure its DSN as a server-side deployment secret, enable source maps through the hosting provider's secure workflow, and scrub personally identifying or ticket content before sending events.
- For incidents, note the UTC time, affected account/route, request or trace ID if available, and relevant error code. Do not paste secrets into issue trackers.

## Recovery checklist

1. Identify whether the incident affects the app, Supabase Auth, database, or Storage.
2. Preserve relevant logs and stop repeated destructive retries.
3. Restore into a separate project first and verify data before redirecting production traffic.
4. If credentials may have leaked, rotate them and redeploy. Never put the service-role key in browser-exposed variables.
5. Document the cause, recovery point, data loss if any, and follow-up actions.
