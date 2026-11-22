# Abstract Management System (AMS)

Multi-tenant SaaS for Sri Lankan symposiums: submit → review → decide → register & pay.
Full spec: @docs/requirements.md (requirement IDs like SUB-12, DEC-09 are the source of truth).

## Stack
Next.js (App Router, TypeScript), Supabase (Postgres, Auth, Storage, RLS), Tailwind + shadcn/ui.
Package manager: **yarn only**. Never run npm or pnpm, and never create package-lock.json.

## Status
- DONE: Module 1 (Event setup), Module 2 (Submission), Module 3 (Review)
- TODO: Module 4 (Decisions), Module 5 (Ticketing), cross-cutting GEN-*, frontend polish

## Hard rules
1. Every table has org_id (and event_id if event-level). Every table has RLS. New migration = new RLS policies + a test proving org B cannot read org A.
2. Roles attach to event_roles (event membership), never to the user account.
3. Everything configurable per event. No hard-coded college logic.
4. Blind review: author names, affiliations and file names must never reach a reviewer's query when blind_mode != none. Enforce in SQL views/RLS, not in the UI.
5. Times stored in UTC, displayed Asia/Colombo, dates as "19 November 2026".
6. Money: integer minor units + currency (LKR/USD). Verify PayHere signature server-side before marking paid.
7. Mobile-first: every screen must work at 375px.
8. No secrets in the client. Service-role key only in server code.

## Workflow
- Plan first for anything touching more than 2 files. Work one requirement ID at a time.
- Migrations: supabase/migrations/ only. Never edit the DB by hand.
- After changes run: `yarn lint && yarn typecheck && yarn test`
- Add dependencies with `yarn add` / `yarn add -D`. Commit yarn.lock with package.json.
- Commit per requirement ID: "feat(DEC-02): bulk decisions".

## UI standards
See .claude/skills/ams-ui-standards. Use the design tokens; no ad-hoc colours or spacing.
Add shadcn components with: `yarn dlx shadcn@latest add <component>` (Yarn 2+) or `npx shadcn@latest add <component>` (Yarn 1).

## Commands
dev: yarn dev | build: yarn build | db reset: supabase db reset
types: supabase gen types typescript --local > types/supabase.ts