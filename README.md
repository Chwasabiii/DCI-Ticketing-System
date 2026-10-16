# PMSG Desk

PMSG Desk is a ticket-tracking prototype for Design Coordinates, Inc. It is intended to help the Project Management Support Group (PMSG) receive, route, assign, and monitor support requests across Architectural, Structural, Mechanical, Electrical, Cost Control, Documents, IT Services, and Other Support Services.

This repository contains the web application and a draft Supabase database schema. It is a capstone starting point, not a finished production system. The role rules and workflow in the schema are proposals that should be confirmed with DCI before real use.

## Project Goal

The intended ticket workflow is:

1. A client signs in and submits a request with a title, details, and optional discipline/category.
2. A coordinator reviews incoming requests, chooses priority, routes the request, and assigns a staff member.
3. Staff work on the request and add comments or internal notes.
4. Staff mark the work resolved; the client can confirm completion and close the ticket.
5. Managers monitor open, urgent, resolved, and overdue work.

The application has pages and initial behavior for much of this flow. Some sections are demonstrations or placeholders; see [Current Status](#current-status) before treating a feature as complete.

## User Types

- **Client:** Submit tickets, view their requests, comment, and confirm a resolved request.
- **Employee:** Staff access is further divided into Coordinator, Discipline Lead, Personnel, and Manager roles. These roles influence navigation and available ticket actions.
- **Admin:** Invite users and manage the projects available when clients and employees submit support requests.

The database policies also control which records can be read or changed. UI visibility is not a substitute for database authorization; review and test both before deployment.

## Current Status

Implemented in the current prototype:

- Supabase email/password sign-in and session-aware pages.
- Client ticket submission and ticket list/detail pages.
- Basic routing, assignment, priority, status changes, comments, and internal notes.
- Dashboard ticket counts, incoming queue, assigned/discipline views, overdue list, and a basic status report.
- Role-based navigation and initial row-level security policies in the SQL schema.

Still incomplete or needing confirmation:

- Notifications page is a placeholder; the schema has a notifications table, but the app does not yet populate and display notifications.
- Admins can invite client and employee accounts by email and manage project names, codes, locations, and Planned/Ongoing/Completed statuses. Ticket submitters can select Planned and Ongoing projects.
- Department, discipline, and category management pages remain read-only tables.
- Accounts with no sign-in for six months are marked inactive (not deleted); admins are excluded and can restore archived accounts.
- The dashboard's discipline mix uses illustrative values rather than counts calculated from tickets.
- Ticket file uploads are available from ticket submission and ticket details. Cost tables exist in the schema but are not wired into the user interface.
- Ticket comments appear in real time for signed-in users who can view that ticket, once `ticket_comments` is enabled in the Supabase Realtime publication.
- Reports are limited to ticket counts by status. Filtering, date ranges, exports, and business-specific metrics need requirements.
- Confirm status transitions, role permissions, deadlines, internal-note visibility, and client close/reopen behavior with DCI.
- Add automated tests and review authorization in every server action before production. Some server actions currently rely on database RLS to reject unauthorized writes and do not display database errors to the user.

## Technology

- **Next.js 14 App Router** and **React** render the pages and handle server actions.
- **TypeScript** describes application data and catches many code mistakes.
- **Tailwind CSS** styles the pages; shared global CSS is in `src/app/globals.css`.
- **Supabase Auth** manages accounts and sessions.
- **Supabase PostgreSQL** stores profiles, roles, tickets, comments, and reference data.
- **Row Level Security (RLS)** applies database access rules to signed-in users.
- **Supabase Storage** keeps ticket attachments private; ticket-scoped policies and expiring download links control access.

The ticket form's category, discipline, department, and project lookup response is cached privately in the browser for 60 seconds. Ticket, profile, and other user-specific records are not placed in a shared persistent cache.

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
      supabase/           Supabase browser, server, and middleware clients
   middleware.ts         Refreshes/maintains Supabase auth sessions
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
| `/tickets/new` | Submit a support request. |
| `/tickets/[id]` | View a ticket, comments, and available actions. |
| `/queue` | Review new requests before routing. |
| `/assigned` | View tickets assigned to staff. |
| `/discipline` | View discipline-related tickets. |
| `/workload` | View workload information. |
| `/overdue` | Review overdue tickets. |
| `/reports` | View basic counts by ticket status. |
| `/notifications` | Placeholder for user notifications. |
| `/settings` | View the signed-in user's account and roles. |
| `/admin/users` | View user records. |
| `/admin/projects` | Add projects and update their status. |
| `/admin/departments` | View department records. |
| `/admin/disciplines` | View discipline records. |
| `/admin/categories` | View category records. |

The matching source file is under `src/app/`. For example, `/tickets/new` is implemented in `src/app/(app)/tickets/new/page.tsx`.

## Run Locally

### Prerequisites

- Node.js supported by Next.js 14 and npm.
- A Supabase project with its project URL and anon/public key.

### Configure Supabase

1. Create a Supabase project.
2. In the Supabase Dashboard, open **SQL Editor** and run `supabase/schema.sql` against a fresh project. It creates the tables, triggers, RLS policies, private storage bucket, and sample reference records. This draft is intended for initial setup; do not run it repeatedly or against production data without reviewing the SQL.
   If the project already has the original schema installed, run `supabase/migrations/20261012_ticket_attachments.sql` instead to apply the attachment bucket limit and ticket-scoped access policies.
   Run `supabase/migrations/20261012_ticket_comments_realtime.sql` to enable live comment updates on an existing database.
   Run `supabase/migrations/20261012_admin_accounts_and_auto_archive.sql` on an existing database to restrict archived-account access and schedule the daily six-month inactivity archive.
   Run `supabase/migrations/20261015_project_statuses.sql` on an existing database to add Planned/Ongoing/Completed project statuses.
   Run `supabase/migrations/20261015_invitation_acceptance.sql` on an existing database to enable invitees to set their own password and profile name.
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
npm run build      # Create a production build
npm run start      # Serve the production build locally
```

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
4. Build admin create/edit workflows and connect the dashboard discipline figures to real ticket data.
5. Implement notifications and any cost/reporting features that stakeholders approve.
6. Add tests for the main user journeys and authorization boundaries; verify the production build before deployment.

## Database and Security Notes

- The schema is `supabase/schema.sql`; it includes sample departments, disciplines, projects, and employee roles.
- Browser and server clients use the Supabase anon key plus the signed-in session so database RLS remains active.
- User invitations use a server-only service-role client and are restricted to active administrators. Disable public sign-ups in Supabase Auth.
- A daily Supabase Cron job marks non-admin profiles inactive after six months without a sign-in. Never-used accounts use their creation date; records are retained and RLS blocks archived users. Admins can restore them.
- Never disable RLS to make a page appear to work. Fix the policy or the user's role and verify access with the intended account.
- Treat sample records and the proposed policies as development material until DCI approves the production data model and permissions.
