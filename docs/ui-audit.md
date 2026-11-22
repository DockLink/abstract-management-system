# UI audit — Modules 1–3

Date: 19 November 2026 · Audited against `.claude/skills/ams-ui-standards` · No code was changed.

**Method.** The `yarn dev` app was driven with Playwright and signed in as the seeded platform admin. Org `demo-college`, event `aas-2026` (3 submissions, 4 categories, 3 submission types, 0 reviewers, 0 assignments). Every route was captured as a full-page screenshot at 375×812 and 1280×800 in `docs/ui-audit/`. At each width a script measured horizontal scroll, tap targets under 44 px, icon buttons with no label, and console errors. That was paired with a source review (grep for raw palette classes, state handling, focus styles).

**Coverage limits.**
- No event has reviewers or review assignments, so the reviewer dashboard, review screen and `/my-reviews` show only their *not a reviewer*, *not found* and *empty* states. Their populated layouts were reviewed from source (`components/reviews/*`) and are marked *(code)* below.
- There is no sign-up page. The only auth screen is `/login`, and accounts arrive by invite.
- The red "1 Issue" pill in the submitter and reviewer screenshots is the Next.js dev overlay (see P1-12). It doesn't appear in production, but the error behind it is real.

---

## 1. Route inventory

| Route | Who sees it | Screenshots | Verdict |
|---|---|---|---|
| `/login` | Everyone signed out | `login-*` | 🟡 Works; generic, brand reads "DOCLINK", no forgot-password |
| `/org/[org]` (events list) | Org admin, platform admin | `org-admin-*` | 🟡 Table clipped on mobile; actions off-screen |
| `/org/[org]/events/[event]` → dashboard | Event admin | `event-overview-*`, `admin-dashboard-*`, `admin-nav-drawer-375` | 🔴 Shows 0 submissions and 0 reviews; numbers are stubbed |
| `…/setup` (basics, public page, key dates) | Event admin | `event-setup-*` | 🟡 Native date/file inputs; no unsaved-changes cue |
| `…/categories` | Event admin | `categories-*` | 🟡 Table clipped on mobile; 36 px row actions |
| `…/submission-types` + form builder | Event admin | `submission-types-*`, `form-builder-*` | 🟡 Dialog footer covers "Add section" on mobile; spec IDs in copy |
| `…/eligibility` | Event admin | `eligibility-*` | 🟡 Save sits at top; "DEC-09" shown to users |
| `…/members` | Event admin | `members-*` | 🟡 Table clipped on mobile; destructive "Clear list" is the first action |
| `…/settings` | Event admin | `event-settings-*` | 🟡 Brand colour (GEN-02) not editable; inconsistent layout |
| `…/submissions` | Event admin, track chair | `admin-submissions-*` | 🟡 Table hides status/actions on mobile; 32 px controls |
| `…/reviews` (Progress, Reviewer pool, Rubric, Assignments, Scores) | Event admin, track chair | `admin-reviews-*`, `review-*-{375,1280}` | 🟠 Different visual language from the rest of admin; tabs clipped on mobile; raw colours |
| `/[org]/[event]` (public event page) | Public, authors, reviewers | `public-event-*`, `public-event-loggedout-*` | 🟠 No event branding, guidelines or sign-in; mobile drops half the dates |
| `/[org]/[event]/submit` (5-step wizard) | Submitter | `submit-abstract-*`, `submit-step{2..5}-*`, `submit-loggedout-*` | 🔴 Submit and Continue buttons cut off at 375 px; checklist shows false ticks |
| `/[org]/[event]/my-submissions` | Submitter | `my-submissions-*` | 🟠 Good card layout; own status colours; misleading draft copy |
| `/[org]/[event]/reviews` (reviewer dashboard) | Reviewer | `reviewer-dashboard-*` | 🟠 Error shown twice (toast and page); no way back for admins |
| `/[org]/[event]/reviews/[assignmentId]` (review screen) | Reviewer | `review-screen-*` | 🔴 *(code)* Autosave state hidden on mobile; two nested scroll panes |
| `/my-reviews` | Reviewer | `my-reviews-*` | 🟡 Good empty state; different header style |

Legend: 🔴 has P0 · 🟠 several P1 · 🟡 P1/P2 only.

**Measured across all routes**
- No route scrolls the *page* sideways at 375 px. Wide content is either clipped in an `overflow-hidden` card or overflows inside a table wrapper.
- Tap targets: on every admin route at 375 px, **100 % of interactive elements are under 44 px tall**. The buttons on the page come in 4 heights: 25, 28, 32 and 36 px, with 40 for primary.
- The Tailwind palette is used directly (`bg-slate-100`, `text-emerald-700`…) **≈430 times**, almost all in `components/reviews/*` and `components/submissions/*`. The Module 1 setup screens use tokens correctly.
- `globals.css` defines light tokens only; there is no `.dark` block. Meanwhile the review screens carry ~110 `dark:` classes, so dark mode is half-built and can't be switched on.
- `Skeleton` is installed but used **0 times**. **No screen has a retry action.**

---

## 2. Problems by route

### P0: broken or unusable on mobile, or wrong information

| # | Route | Problem | Evidence |
|---|---|---|---|
| P0-1 | Submit, step 5 | **The "Submit abstract" button is pushed off-screen at 375 px**, so only a green sliver shows at the right edge. The footer puts *Back to edit*, *Save draft* and *Submit* in one row inside an `overflow-hidden` card. An author on a phone cannot submit. | `submit-step5-375.png` |
| P0-2 | Submit, step 3 | Same footer bug: "Continue to Ethics & Declarations" runs past the card edge. | `submit-step3-375.png` |
| P0-3 | Submit, step 5 | **The readiness checklist shows green ticks for failing items**: "Title: Provided (0 chars)", "Presenter marked: None", "Word count 0 / 300", "Author consent: Confirmed" while the consent toggle is off. Authors will trust it and submit incomplete work, or be blocked by the server with no clue why. | `submit-step5-*.png` |
| P0-4 | Submit, stepper | You can jump to any step from the stepper with nothing filled in, and steps 1–4 then show as ✓ complete. | `submit-step{2..5}-375.png` |
| P0-5 | Event dashboard | **The KPIs and charts are hard-coded to zero.** `dashboard/route.ts` returns `submissionsByStatus: {}`, `submissionsByCategory: []` and review count 0, while the event has 3 submissions (and the Reviews → Progress tab shows "3"). Admins get the wrong picture. | `admin-dashboard-*.png`, `app/api/v1/…/dashboard/route.ts:59-67` |
| P0-6 | Review screen *(code)* | The autosave indicator is `hidden md:flex`, so reviewers on phones never see "Saving… / Saved". The spec's main use case is reviewing on a phone between clinics. | `review-screen.tsx:354` |
| P0-7 | Review screen *(code)* | Both columns are `overflow-y-auto max-h-[calc(100vh-53px)]`, and on mobile they stack. The result is two full-height nested scroll panes, so a reviewer scrolling the abstract gets trapped and can't reach the scoring form. **Needs confirming with a real assignment.** | `review-screen.tsx:427,547` |
| P0-8 | Review screen *(code)* | The back button on mobile is icon-only. Its label is a `hidden sm:inline` span, which gives it no accessible name, and it is 32 px tall. | `review-screen.tsx:337-341` |

### P1: inconsistent or confusing

**Cross-cutting**
- P1-1 **Two design languages.** Module 1 (setup) uses tokens, `PageHeader`, `StatusBadge` and shadcn `Tabs`. Module 2/3 (submit, my-submissions, reviews) uses raw Tailwind colours, hand-rolled tab buttons, all-caps eyebrows ("SUBMISSION PORTAL", "SUBMISSIONS", "IN PROGRESS"), `font-extrabold` page titles with an icon, and an emerald "Submit" green that differs from the teal primary.
- P1-2 **Status colours disagree.** `StatusBadge` maps Draft→blue, Under review→blue, Waitlisted→amber. `submitter-dashboard.tsx` has its own `STATUS_CONFIG` (Draft→slate, Under review→amber), and the review screens add a third. The standard is Draft grey, Submitted blue, Under review amber, Accepted green, Rejected red, Confirmed emerald, Waitlisted purple, and none of the three maps match it.
- P1-3 **Tap targets.** The shadcn defaults (`h-8`/`h-9`) are used everywhere: the menu button is 32 px, row actions 36 px, filter selects 32 px, the stepper 32 px, review tabs 28 px. Senior consultants on phones need ≥ 44 px.
- P1-4 **Wide tables on mobile** (events list, categories, members, admin submissions, review progress/scores) are clipped. Status and actions are hidden past the edge, and nothing shows that the table scrolls. These should collapse to cards below `sm`.
- P1-5 **Loading states** are a full-screen spinner (`Loader2`) or nothing; there are no skeletons. **Error states have no retry**, and the reviewer screens show the same error twice (toast plus page).
- P1-6 **Dates:** "10 Nov", "01 Jan" and "Updated 17 Nov" drop the year next to dates in 2027, so it's ambiguous which year is meant. Setup shows ISO-style `2027-02-15, 15:40` in native inputs. The standard is "19 November 2026", Asia/Colombo.
- P1-7 **Spec and dev jargon in the UI:** "DEC-09", "Module 3", "Read-only in v1", "REV-03", "Today marker is relative to Asia/Colombo deadlines" (and no today marker is visible).
- P1-8 **Event brand colour (GEN-02) is ignored.** `primaryColor` is stored and edited through the API, but no page applies it, and Settings → Branding has no colour or logo field. The public page shows no logo or banner either.
- P1-9 **Focus:** the custom stepper uses `focus:outline-none` with no replacement, and the custom review tabs and TipTap editors have no visible focus ring.
- P1-10 **Native `<select>`** in Reviews (6 instances, e.g. Scores → "All categories") next to shadcn `Select` everywhere else.
- P1-11 **Body text is 14 px (`text-sm`) everywhere**, and the review screen uses 10–11 px labels (`text-[10px]`, `text-[11px]`). That's too small for the audience.
- P1-12 **Next.js prerender error on every submitter and reviewer route:** `Route "/[orgSlug]/[eventSlug]/…" encountered the unstable value Date.now()`. It comes from calling Supabase auth before the route opts into dynamic rendering under `cacheComponents`. It's dev-only noise today but a correctness bug.

**Per route**
- *Public event page:* there's no sign-in or sign-out, and anonymous visitors see "My submissions" and "Reviewer portal". The **mobile timeline drops 3 of 6 milestones** (notification, early-bird, registration close). "Reviewer Portal →" is a purple link styled unlike anything else. No guidelines or contact details are shown.
- *Submit wizard:*
  - No event name or context on the page.
  - Selects are content-width rather than full-width.
  - "Save draft" is only at the top on mobile, with no "Saved 12:04" indicator.
  - On step 4, the ERC options look like disabled inputs rather than choices, and declarations use switches where checkboxes are expected. "No conflicts of interest" is pre-switched **on**, which defaults a legal declaration for the author.
  - Step 3 shows 5 full TipTap toolbars, and the toolbar wraps onto a second line at 375 px.
- *My submissions:* draft copy says "Saved locally. Not visible to reviewers", but drafts are saved on the server. Withdraw is a plain text button with no visible danger cue.
- *Admin reviews:*
  - The tab row is cut off ("Scorin… Rubric") with no scroll cue.
  - The KPI cards use different styling from the dashboard's KPI cards.
  - The header actions stack awkwardly at 1280.
  - The Conflicts KPI card sits alone in a full-width row.
- *Form builder (mobile):* the sticky footer covers the "New section title / Add section" row. Section names truncate ("Introdu…"). On phones it should be a full-height sheet.
- *Eligibility / Settings / Setup:* the save buttons sit in different places (top of page, inside card, bottom of tab). The destructive "Clear list" on Members is the first, most prominent action.

### P2: polish
- Login card has "DOCLINK" all-caps eyebrow and no event/college context; no "Forgot password".
- Mobile top bar shows event name + page name; no breadcrumb back to org.
- Empty dashboard charts show "No submission data yet." with no next action.
- Monospace ref numbers (`AAS26-0002`) vary in size/weight across screens.
- `"Review Portal Unavailable … or your session has expired"` conflates two causes; distinguish not-a-reviewer vs signed-out.
- Title case is inconsistent ("Check Duplicate Titles", "Add Rubric Criterion" vs "Add category", "Save changes").
- The certificate modal hard-codes `Georgia, serif`, and `certificate.ts` has 14 hex colours. That's acceptable for a printable artefact, but they should become named constants.
- `Submit abstract` uses a sparkle icon, which reads as playful in a clinical tool.

---

## 3. Duplicated UI patterns → shared components

| Pattern | Where it is duplicated | Proposed component |
|---|---|---|
| Status colour maps | `shared/status-badge.tsx`, `submitter-dashboard.tsx` (`STATUS_CONFIG`), review screens (inline classes) | One `StatusBadge` + `lib/status.ts` with the canonical map from the standards skill (incl. revisions, withdrawn, review states) |
| Loading spinner page | `reviewer-dashboard`, `my-reviews-page`, `review-screen`, `reviewer-certificate-modal` | `<PageSkeleton variant="table|cards|form">` built on `Skeleton` |
| Error / unavailable page | `reviewer-dashboard`, `review-screen`, server pages | `<ErrorState title action onRetry>` (pairs with existing `EmptyState`) |
| KPI / stat card | `dashboard/page.tsx`, `admin-reviews-page` progress cards | `<StatCard label value hint href>` |
| Progress bar with `style={{width}}` | dashboard, admin-reviews (×2) | `<ProgressBar value>` (or shadcn `Progress`) |
| Hand-rolled tab bar | `admin-reviews-page` (5 buttons), wizard stepper | shadcn `Tabs` with a scrollable `TabsList`; separate `<Stepper>` |
| Responsive data table | events list, categories, members, admin submissions, review progress, scores | `<DataTable columns mobileCard={row => …}>` that becomes a card list below `sm` |
| Filter bar (search + selects) | admin submissions, review scores, members | `<FilterBar>` with full-width controls on mobile |
| Page title block | `PageHeader` (setup) vs custom h1+icon (reviews, submit, my-reviews) | Use `PageHeader` everywhere; add `eyebrow` slot only where it carries information |
| Sticky form footer | wizard steps, form builder, settings cards | `<FormFooter>` (sticky bottom on mobile, wraps, primary last) + `<SaveIndicator savedAt>` |
| Date display | `key-date-timeline`, `event-date`, submitter cards, setup inputs | `formatDate`/`formatDateTime` in `lib/dates.ts` + `<EventDate>` everywhere; shadcn date picker instead of native inputs |
| Toggle-with-description row | eligibility, settings, wizard declarations | `<SettingRow title description control>` (checkbox variant for declarations) |
| Confirm destructive action | members clear list, withdraw, delete criteria | Existing `ConfirmDialog`; apply consistently |

---

## 4. Proposed visual direction

1. **Mood: "the good hospital chart".** Quiet, ordered and legible at arm's length. Confidence comes from generous type and clear status, not decoration.
2. **Type:** use **Source Serif 4** for event names and page titles (an academic register that feels like a college proceedings book) and **Source Sans 3** for all UI and body text. Body is 16 px (15 px in dense admin tables) with 1.5 line height. Never go below 13 px.
3. **Palette:**
   - Ink `#1F2933` for text.
   - Paper `#F7F8F6` (a cool off-white, not cream) with white `#FFFFFF` surfaces.
   - A single action colour: the event's own `primaryColor`, defaulting to deep clinical teal `#0F6E6A` (AA on white).
   - Rule lines `#D9DEDB`.
   - Status colours are muted, tinted pairs: grey, blue, amber, green, red, emerald, purple.
4. **Shape:** 8 px radius on cards and 6 px on controls. Use 1 px rules instead of shadows, with one elevation level reserved for dialogs and sheets. Controls are 44–48 px tall with full-width inputs on mobile.
5. **Motion and tone:** motion only answers actions (save confirms, a sheet opens). Copy is sentence case, short and plain ("Submit abstract" → toast "Abstract submitted"). No eyebrows, no sparkles, no all-caps.

---

## 5. Recommended order of work

1. **Fix the P0 flows that stop real users (1–2 days):**
   - The wizard footer overflow on steps 3 and 5.
   - A truthful readiness checklist, with steps marked complete only once they validate.
   - Real dashboard counts.
   - The review-screen mobile save indicator, back button and single scroll pane. Seed one reviewer and one assignment first so this can be verified.
2. **Tokens and dark mode:** add the palette and type scale to `globals.css` with a `.dark` block. Apply `primaryColor` as `--primary` on public and submitter routes (GEN-02). Bump the control heights in `components/ui/button|input|select` to 44 px on touch.
3. **Status system:** one canonical map and `StatusBadge`. Replace `STATUS_CONFIG` and the inline review classes.
4. **Shared state components:** `PageSkeleton`, `ErrorState` with retry, `StatCard`, `FormFooter` and `SaveIndicator`. Then go screen by screen through the four states.
5. **Responsive `DataTable`** with a mobile card mode. Roll it out to submissions, events, categories, members and review tables.
6. **Migrate Module 2/3 screens onto the system:** submit wizard, my-submissions, reviewer dashboard, review screen, admin reviews. Remove raw palette classes (≈430), native selects and custom tabs.
7. **Copy and date pass:** remove spec IDs from the UI, use full dates with years via `lib/dates.ts`, sentence case, and fix the misleading draft and declaration defaults.
8. **Public event page refresh:** branding, guidelines, contact details, sign-in state and the full timeline on mobile.
9. **Polish (P2)** and fix the `Date.now()` prerender error under Cache Components.
10. Re-run this audit script at 375 and 1280 as the done check for each step.
