# Security posture and deployment checklist

## Application protections

- User-specific rows and ticket data are protected by Supabase Row Level Security. Keep using the session-bound Supabase client for normal reads/writes; only the admin service client may bypass RLS, and server actions verify an active administrator first.
- Ticket assignment and status changes check the employee's role in server actions and in a database trigger/RLS policy, so direct Supabase API calls cannot bypass those field-level role rules. Clients may only close their own resolved tickets through a narrowly scoped database function. The `20261105_remove_project_and_routing_workflows.sql` migration disables automatic routing and project approvals while retaining legacy records.
- Client accounts can read their own profile. Ticket pages use scoped functions to return only names for participants on tickets the caller can access.
- Ticket attachments remain private, are limited to 10 MB each and five per user per ticket, and the bucket allows only common document, image, text, and CSV MIME types. This is not malware scanning; staff should still treat files from users as untrusted.
- Standard browser response headers reduce MIME sniffing and clickjacking risks. Production responses include HSTS; the hosting platform must still force HTTPS.
- Ticket edit and notification writes use parameterized Supabase queries/RPCs. User-generated text renders through React text nodes, not raw HTML.

## Required project settings

1. Apply the SQL migrations in order, including `20261025_security_basics.sql`. The profile policy and server-side authorization protections are not active in a Supabase project until that migration succeeds.
2. Disable public sign-ups if the service is invitation-only. Enable MFA for administrator accounts in Supabase Auth and keep the administrator list small.
3. Keep Supabase Auth rate limits enabled. Do not raise every Auth limit to make invitation emails flow: the built-in email sender has a low project email quota and is intended for testing; use a properly configured SMTP provider for production-volume email.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only, out of browser variables and source control. Rotate it immediately if it may have been exposed.
5. Configure the production host for HTTPS-only traffic, production secrets, log access controls, and backup/restore procedures as described in `SUPABASE_OPERATIONS.md`.

## Review limits

The repository review and npm advisory scan do not prove that the deployed Supabase policies are applied or that production settings are correct. No live database authorization exercise or penetration test has been performed.

`npm audit --omit=dev` reported no production dependency vulnerabilities. The full audit reported five high-severity findings through the development-only `eslint-config-next` → `fast-glob` → `micromatch` → `braces@3.0.3` chain. The current advisory lists no patched `braces` version; `npm audit fix --force` proposes a breaking downgrade of `eslint-config-next`, so it was not applied. Recheck the advisory and dependency tree before releases.
