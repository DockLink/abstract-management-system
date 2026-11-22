---
name: ams-ui-standards
description: Use when building or editing any page, form, table, or component in the AMS app. Defines design tokens, mobile rules, and states every screen must have.
---

# AMS UI standards

## Users
Senior Sri Lankan consultants reviewing on phones between clinics; college secretaries on desktops. Calm, clinical, trustworthy. Not flashy.

## Rules
- Mobile first: design at 375px, then enhance. Touch targets >= 44px. No horizontal page scroll; wide tables scroll in their own container or collapse to cards.
- Use shadcn/ui primitives and the tokens in globals.css. Never hard-code hex colours; brand colour comes from the event's primary colour variable (GEN-02).
- Every data screen has: loading skeleton, empty state with a next action, error state with retry, and success toast.
- Forms: inline validation, labels above inputs, help text, disabled+spinner while saving, autosave indicator ("Saved 12:04") where the requirement says auto-save.
- Status always shown as a Badge with consistent colour mapping (Draft grey, Submitted blue, Under review amber, Accepted green, Rejected red, Confirmed emerald, Waitlisted purple).
- Accessibility: visible focus rings, AA contrast, aria-labels on icon buttons, keyboard-navigable.
- Dates "19 November 2026", times in Asia/Colombo. English copy, short and plain.
- Support light and dark mode via tokens.

## Done checklist
Screenshot at 375px and 1280px, check all four states, run lint + typecheck.
