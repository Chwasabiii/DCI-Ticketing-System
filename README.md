# PMSG Desk

PMSG Desk is a ticket-tracking prototype for Design Coordinates, Inc. It supports three account types: end users, service providers, and administrators. Service providers belong to a team. The initial team directory includes IT Support Department, Cost Control Group, and Software CSR as active teams, plus Architectural, Structural, Mechanical, Electrical, Documents, and Other Support Services for future expansion.

This repository contains the web application and a draft Supabase database schema. It is a capstone starting point, not a finished production system. The role rules and workflow in the schema are proposals that should be confirmed with DCI before real use.

## Project Goal

The intended ticket workflow is:

1. A client signs in and submits a request with a title, details, and request type.
2. Service providers review requester-reported High impact or urgency before it affects the SLA, confirm or lower the values, and coordinators assign staff. Providers can also claim unassigned team requests or take over an assigned request when its SLA is at risk. The priority matrix calculates confirmed priority. For incidents, IT Support records its inspection and root-cause findings; unresolved software incidents can be escalated to the Software CSR service team.
3. Staff work on the request and add comments or internal notes.
4. Staff mark the work resolved; the client can confirm completion, or reopen it with a reason if the problem remains.
5. Managers monitor open, urgent, resolved, and overdue work.

The application has pages and initial behavior for much of this flow. Some sections are demonstrations or placeholders; see [Current Status](#current-status) before treating a feature as complete.

## User Types

- **Client:** Submit tickets, view their requests, comment, and confirm a resolved request.
- **Employee:** Staff access is divided into Coordinator, Personnel, and Manager roles. These roles influence navigation and available ticket actions.
- **Admin:** Invite and manage users, FAQs, and SLA targets.

The database policies also control which records can be read or changed. UI visibility is not a substitute for database authorization; review and test both before deployment.

## Current Status

Implemented in the current prototype:

- Supabase email/password sign-in and session-aware pages.
- Client ticket submission and ticket list/detail pages.
- Assignment, priority, status changes, comments, and internal notes.
- Dashboard ticket counts, incoming queue, assigned view, overdue list, and a triage inbox with server-side search, filters, pagination, and saved views.
- In-app notifications, unread counts, mark-read actions, and per-user notification preferences.
- Ticket reports with date, status, and service-team filters; paginated results; admin CSV export; and workload/SLA indicators.
- Role-based navigation and initial row-level security policies in the SQL schema.
- Vitest unit tests for priority/SLA calculations and ticket-draft storage, plus a pgTAP RLS suite in `supabase/tests/`.

Still incomplete or needing confirmation:
- Admins can invite client and employee accounts by email.
- Ticket submission supports Service Request, Access Request, and Incident Report types, each tagged with one of six service categories. Incident tickets move through IT inspection and root-cause analysis before resolution.
- Requesters can mark tickets confidential. Confidential ticket data and files are restricted by database policies to the requester, administrators, and assigned employees.
- Signed-in users can read published FAQs; administrators create, edit, publish, and delete them.
- Accounts with no sign-in for six months are marked inactive (not deleted); admins are excluded and can restore archived accounts.
- Ticket file uploads are available from ticket submission and ticket details. Cost tables exist in the schema but are not wired into the user interface.
- Ticket comments appear in real time for signed-in users who can view that ticket, once `ticket_comments` is enabled in the Supabase Realtime publication.
- Report averages currently use elapsed calendar time; confirm with DCI whether operational KPIs should instead use business hours, exclude waiting periods, or follow another definition.
- The database RLS suite covers core ticket, comment, and attachment access, but application/server-action tests and broader workflow coverage are still needed.
- Confirm status transitions, role permissions, deadlines, internal-note visibility, and client close/reopen behavior with DCI before production.
- Production readiness still depends on applying and verifying migrations, configuring SMTP/MFA/secrets/monitoring, and practicing database, Auth, and Storage recovery. See [Security](./docs/SECURITY.md) and [Operations](./docs/SUPABASE_OPERATIONS.md).

## Technology

- **Next.js 16 App Router** and **React 19** render the pages and handle server actions.
- **TypeScript** describes application data and catches many code mistakes.
- **Tailwind CSS** styles the pages; shared global CSS is in `src/app/globals.css`.
- **Supabase Auth** manages accounts and sessions.
- **Supabase PostgreSQL** stores profiles, roles, tickets, comments, and reference data.
- **Row Level Security (RLS)** applies database access rules to signed-in users.
- **Supabase Storage** keeps ticket attachments private; ticket-scoped policies and expiring download links control access.

Legacy project, department, discipline, category, and routing tables remain in the database for historical records. The app no longer reads or manages them; the final removal migration disables automatic routing and project approval gates without deleting stored records.

## Folder Guide

```text
src/                    Application source code
   app/                  Pages and URL routes
      (app)/              Signed-in application pages
      (auth)/login/       Sign-in page
      globals.css         Global styles and Tailwind directives
      layout.tsx          Root HTML layout and global stylesheet import
   components/           Reusable UI: navigation, forms, tables, buttons
   lib/
      actions.ts          Form submissions and server-side ticket actions
      data.ts             Supabase queries used by pages
      navigation.ts       Menu items for user sides and employee roles
      types.ts            Shared TypeScript data types
      supabase/           Supabase browser, server, and proxy clients
   proxy.ts              Refreshes/maintains Supabase auth sessions
supabase/schema.sql     Database tables, triggers, policies, sample data
logs/                   Local development logs (ignored by Git)
```

In Next.js, a `page.tsx` file defines a page. For example, `src/app/(app)/tickets/page.tsx` serves `/tickets`; the `(app)` folder is an organizational route group and is not part of the URL. Shared visual elements belong in `src/components/`. Database queries, mutations, and shared types belong in `src/lib/`.

## Main Pages

| URL | Purpose |
| --- | --- |
| `/login` | Sign in to the application. |
| `/dashboard` | Ticket summary and recent requests. |
| `/tickets` | Browse tickets available to the signed-in user. |
| `/tickets/new` | Choose IT Support or Cost Control Group, then submit a team-specific request. |
| `/tickets/[id]` | View a ticket, comments, and available actions. |
| `/inbox` | Staff triage inbox for unassigned, assigned-to-me, and overdue tickets. |
| `/queue` | Focused incoming-ticket queue. |
| `/assigned` | Focused view of tickets assigned to staff. |
| `/workload` | View workload information. |
| `/overdue` | Focused overdue-ticket view. |
| `/reports` | View basic counts by ticket status. |
| `/performance` | Review rolling individual and service-team KPI scores. |
| `/raci` | Staff-facing RACI matrix for ticket lifecycle responsibilities. |
| `/notifications` | Placeholder for user notifications. |
| `/settings` | View the signed-in user's account and roles. |
| `/admin/users` | View user records. |

The matching source file is under `src/app/`. For example, `/tickets/new` is implemented in `src/app/(app)/tickets/new/page.tsx`.

## Run Locally

### Prerequisites

- Node.js supported by Next.js 16 and npm.
- A Supabase project with its project URL and anon/public key.

### Configure Supabase

1. Create a Supabase project.
2. In the Supabase Dashboard, open **SQL Editor** and run `supabase/schema.sql` against a fresh project. It creates the tables, triggers, RLS policies, private storage bucket, and sample reference records. This draft is intended for initial setup; do not run it repeatedly or against production data without reviewing the SQL.
   If the project already has the original schema installed, run `supabase/migrations/20261012_ticket_attachments.sql` instead to apply the attachment bucket limit and ticket-scoped access policies.
   Run `supabase/migrations/20261012_ticket_comments_realtime.sql` to enable live comment updates on an existing database.
   Run `supabase/migrations/20261012_admin_accounts_and_auto_archive.sql` on an existing database to restrict archived-account access and schedule the daily six-month inactivity archive.
   Run `supabase/migrations/20261015_project_statuses.sql` on an existing database to add Planned/Ongoing/Completed project statuses.
   Run `supabase/migrations/20261015_invitation_acceptance.sql` on an existing database to enable invitees to set their own password and profile name.
   Run `supabase/migrations/20261017_project_approval_workflow.sql` after the schema on every database to add project approvers, ticket request types, and approval gating.
   Then run `supabase/migrations/20261018_confidential_tickets_and_faqs.sql` to apply confidential-ticket access policies and the FAQ table.
   Run `supabase/migrations/20261019_seed_faq_examples.sql` to add starter FAQ examples. They can be edited or unpublished by an administrator.
   Run `supabase/migrations/20261020_ticket_activity_timeline.sql` to publish ticket audit events for live activity updates and record readable routing and assignment details.
   Run `supabase/migrations/20261021_repair_missing_profiles.sql` to create default client profiles for any existing Auth accounts that are missing one and ensure future accounts get a profile.
   Run `supabase/migrations/20261022_ticket_requester_read_policy.sql` to ensure requesters can read their own newly created ticket rows when the app uses `INSERT ... RETURNING`.
   Run `supabase/migrations/20261023_ticket_notifications.sql` to create in-app notifications for ticket submissions, assignments, comments, and updates.
   Run `supabase/migrations/20261024_audit_details_and_notification_preferences.sql` to log changed ticket fields and enable per-user in-app notification preferences with duplicate-event protection.
   Run `supabase/migrations/20261025_security_basics.sql` to limit profile exposure, enforce ticket role checks, protect ticket participant lookups, and restrict private attachment uploads.
   Run `supabase/migrations/20261026_ticket_duplicate_detection_and_links.sql` to suggest similar visible open tickets and add staff-managed related-ticket links.
   Run `supabase/migrations/20261027_automatic_ticket_routing.sql` only when migrating an older database that needs its original schema history; the removal migration below disables this workflow.
   Run `supabase/migrations/20261028_inbox_productivity_features.sql` to add SLA targets and first-response tracking, plus the staff-only ticket handoff RPC. Saved inbox views are stored in each browser; bulk actions and onboarding tips need no database changes.
   Run `supabase/migrations/20261029_sla_escalations.sql` to schedule in-app alerts when a ticket misses its first-response or resolution SLA. This requires `pg_cron` to be enabled in Supabase; alerts are deduplicated per ticket and SLA type. The later business-day SLA migration updates the alert job to use the High and Standard priority groups.
   Run `supabase/migrations/20261030_ticket_satisfaction_surveys.sql` to add requester satisfaction surveys after resolution.
   Run `supabase/migrations/20261031_ticket_activity_author_sides.sql` to distinguish requester and staff authors in ticket activity.
   After all existing migrations through `20261031`, run `supabase/migrations/20261105_remove_project_and_routing_workflows.sql` to disable project approvals and automatic routing while retaining existing database records. Then run `supabase/migrations/20261106_service_teams.sql` to add team assignment and scope tickets to their service team, followed by `20261107_end_users_only_ticket_creation.sql` to reserve ticket submission for end users, `20261108_team_faq_management.sql` to let IT Support and Cost Control Group providers manage their own team's FAQs, `20261109_business_day_sla_targets.sql` to use High versus Standard SLA policies measured in weekdays, `20261110_ticket_priority_matrix.sql` to classify priority from ticket impact and urgency, `20261111_requester_ticket_reopen.sql` to let requesters reopen resolved or closed tickets, and `20261112_service_provider_ticket_claiming.sql` to let providers claim unassigned team tickets and take over work when an SLA is at risk. Then run `supabase/migrations/20261113_it_ticketing_process_map.sql` to add service categories and request types from the IT process map, with incident inspection and root-cause documentation in the ticket workflow. Approval gates are intentionally not enabled. Then run `supabase/migrations/20261114_software_csr_incident_escalation.sql` to add the Software CSR service team and allow IT Support Personnel to escalate documented, unresolved software incidents to its queue. Finally, run `supabase/migrations/20261115_requester_priority_review.sql` so requester-reported High impact or urgency stays at the Standard SLA until a provider reviews it in the triage inbox. Then run `supabase/migrations/20261116_ticket_solutions_to_faq_drafts.sql` to let service providers turn resolved ticket solutions into unpublished, team-owned FAQ drafts for review. Run `supabase/migrations/20261117_provider_ticket_resolution.sql` to allow same-team Coordinators to update ticket status and resolution notes. Run `supabase/migrations/20261118_assignment_notification_recipients.sql` to notify the requester that the ticket was assigned and reserve the “assigned to you” message for the assigned provider. Finally, run `supabase/migrations/20261119_ticket_resolved_notifications.sql` to notify ticket participants with a clear resolution message when the provider marks a ticket resolved.
3. Create a test user in Supabase Authentication. The project currently has a sign-in page, not a public sign-up page.
4. For the first administrator, update the new user's profile in the SQL Editor, replacing the email:

   ```sql
   update public.profiles
   set user_side = 'admin'
   where email = 'you@example.com';
   ```

5. In Supabase Authentication settings, disable public sign-ups so new accounts are created by administrator invitation only. Configure email delivery for invitation links.
6. Add the Supabase service-role key to the server's `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`. It is used by admin invitations and archived-account reactivation; never prefix it with `NEXT_PUBLIC_` or expose it to browser code.
7. In **Authentication > Email Templates > Invite user**, set the invitation link to:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite&amp;next=/accept-invitation">Accept your invitation</a>
   ```

   `.RedirectTo` uses the app URL passed by the invitation action. The invite link first opens an acceptance page; the invitee must click **Accept invitation** to verify it. This prevents email security scanners that automatically open links from consuming the one-time token. Add the callback URL (for example `http://localhost:3000/auth/callback` and your deployed `https://your-app.example/auth/callback`) to **Authentication > URL Configuration > Redirect URLs**. Set `NEXT_PUBLIC_SITE_URL` to the app's origin in `.env.local` and in the deployed server environment.
   If the app displays **Invitation link incomplete**, the link in the delivered email did not include `token_hash` and `type`. Saving the Redirect URLs allow-list is not sufficient; confirm the **Invite user** email template link above is saved, then send a new invitation.
8. Review the SQL policies, invitation roles, and archiving rules with the project owner. The schema itself labels these access rules as proposed.

### Configure and Start the App

1. Create `.env.local` in the repository root with your Supabase project values:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

2. Install packages and start the development server:

   ```bash
   npm install
   npm run dev
   ```

3. Open the local URL printed by Next.js, usually `http://localhost:3000`, and sign in with the test user.

Never put a Supabase service-role key in browser-exposed variables or commit real credentials. `.env.local` is private local configuration.

## Useful Commands

```bash
npm run dev        # Start the local development server
npm run typecheck  # Check TypeScript types
npm run lint       # Run Next.js lint checks
npm test           # Run unit tests
npm run build      # Create a production build
npm run start      # Serve the production build locally
```

Production backup, migration, and error-monitoring guidance is in [docs/SUPABASE_OPERATIONS.md](docs/SUPABASE_OPERATIONS.md).

If the development site suddenly loses styling or reports missing `/_next` assets, stop duplicate Next.js servers and restart one server. `.next/` is generated output; it is safe to regenerate, but do not edit it by hand.

## Where to Make Changes

- Change a page's content or layout in its `src/app/**/page.tsx` file.
- Change shared navigation, ticket forms, or tables in the matching file under `src/components/`.
- Change global styles in `src/app/globals.css`; change a single element's Tailwind classes beside that element.
- Change Supabase reads in `src/lib/data.ts` and form/write behavior in `src/lib/actions.ts`.
- Change shared data shapes in `src/lib/types.ts`.
- Change database tables, triggers, or access policies in `supabase/schema.sql`, then test the update against a non-production Supabase project.

## Suggested Project Checklist

1. Confirm the ticket lifecycle, priority definitions, employee roles, and access rules with DCI.
2. Verify RLS for client, employee, and admin accounts using separate test users.
3. Finish the ticket experience: clear validation/errors, assignment and due-date handling, audit timeline, and any required reopen/reject paths.
4. Confirm which additional admin workflows and reporting metrics stakeholders need.
5. Implement notifications and any cost/reporting features that stakeholders approve.
6. Add tests for the main user journeys and authorization boundaries; verify the production build before deployment.

## Database and Security Notes

- The schema is `supabase/schema.sql`; it retains legacy reference tables for compatibility with existing data.
- Browser and server clients use the Supabase anon key plus the signed-in session so database RLS remains active.
- User invitations use a server-only service-role client and are restricted to active administrators. Disable public sign-ups in Supabase Auth.
- Legacy project approval values and reference-table rows are retained for history, but the app no longer uses them after the removal migration is applied.
- Confidential ticket access is enforced by Supabase row-level security and storage policies, not just by hiding tickets in the interface.
- A daily Supabase Cron job marks non-admin profiles inactive after six months without a sign-in. Never-used accounts use their creation date; records are retained and RLS blocks archived users. Admins can restore them.
- Never disable RLS to make a page appear to work. Fix the policy or the user's role and verify access with the intended account.
- Treat sample records and the proposed policies as development material until DCI approves the production data model and permissions.
