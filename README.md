# PMSG Desk

PMSG Desk is a capstone prototype for Design Coordinates, Inc. It centralizes
ticket submission, routing, tracking, and monitoring for the Project Management
Support Group across Architectural, Structural, Mechanical, Electrical, Cost
Control, Documents, IT Services, and Other Support Services.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, and Storage

## Setup

1. Copy `.env.local.example` to `.env.local`.
2. Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Install dependencies:

```bash
npm install
```

4. Run locally:

```bash
npm run dev
```

## Notes

- The database schema is `pmsg_desk_supabase_schema.sql`.
- Browser code uses only the Supabase anon key.
- Server and client Supabase calls use the signed-in user's session so RLS remains active.
