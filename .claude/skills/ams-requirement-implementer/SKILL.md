---
name: ams-requirement-implementer
description: Use when asked to implement, verify, or review a requirement ID (EVT-, SUB-, REV-, DEC-, TKT-, GEN-) from the AMS spec.
---

# Implementing a requirement ID

1. Read the row in docs/requirements.md plus the module intro and any related IDs (e.g. DEC-09 + TKT-11).
2. Restate acceptance criteria in 3-6 bullets, including edge cases and who can/can't do it.
3. Plan: migrations, RLS, server actions, UI, emails, audit log. Wait for approval if >2 files.
4. Implement in small commits. Write tests for the permission boundaries first.
5. Verify on the running app (Playwright at 375px and desktop). Report: what changed, how I tested, what's left, any spec ambiguity.
Never silently change spec behaviour; ask.
