---
name: ams-supabase-rls
description: Use when creating or changing Supabase tables, migrations, RLS policies, views, storage buckets, or server actions that touch data.
---

# Supabase + RLS rules for AMS

1. New table => org_id uuid not null (+ event_id for event-level), index on both, RLS enabled in the same migration.
2. Policies are written per role using event_roles. Helper SQL functions: is_org_admin(org), has_event_role(event, role), is_track_chair(event, category). Reuse them; don't inline joins.
3. Blind review: reviewers read abstracts only through a view/RPC that omits authors, affiliations, files metadata and submitter identity when events.blind_mode is single/double.
4. Storage: private buckets, signed URLs, path = {org_id}/{event_id}/{kind}/{uuid}. ERC certificates visible to admins only.
5. Every migration ships with a SQL test (pgTAP or a script) proving cross-org access returns zero rows.
6. Admin actions (decisions, deadline extensions, payment approvals, role changes) write to audit_log in the same transaction.
7. Never use the service-role key in client code. Server actions re-check permissions even though RLS exists.
8. After a migration: regenerate types and fix compile errors.
