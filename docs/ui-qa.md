# UI quality pass — accessibility, dark mode, consistency, performance, copy

20 November 2026 · follows [ui-audit.md](./ui-audit.md)

## How to re-run

```bash
yarn seed:roles        # test users, incl. eventadmin@example.com
yarn test:a11y         # axe + keyboard checks; reuses `yarn dev` on :3000
```

`SEED_TEST_PASSWORD` (or `SEED_ADMIN_PASSWORD`) must be set in `.env`. Specs live in `e2e/`:

- `a11y.spec.ts` runs axe (WCAG 2.0/2.1/2.2 A + AA) on 19 routes as public, submitter, reviewer, chair and event admin, in light and dark, at 375 px and 1280 px (76 checks). It fails on any serious or critical violation.
- `keyboard.spec.ts` checks the skip link, then tabs through the event page, login, reviewer dashboard, admin reviews and the submission wizard. Every stop must be visible and show a focus ring. It also scores a review from the keyboard.

## Result

| Check | Before | After |
| --- | --- | --- |
| axe serious/critical (76 route × theme × width checks) | 29 failing at 375 px alone | 0 |
| Keyboard: skip link | none | "Skip to main content" on every shelled page |
| Keyboard: tab stops without visible focus | — | 0 |
| Dark mode reachable by users | No (forced light, no toggle) | Follows device; Light / Dark / Same as device in the account menu |
| Light "islands" in dark mode (scripted scan of every route) | — | 0 |
| Raw Tailwind palette classes in app code | 20 | 0 (print-only certificate HTML excepted, see below) |
| Requirement IDs shown to users ("(EVT-11)" etc.) | 9 | 0 |
| recharts / TipTap in initial JS of dashboard, submit, settings | yes | no (358 KB and 398 KB raw chunks load on demand) |
| Ad-hoc date formats | 2 | 0 |

## What changed

**Accessibility**

- Account menu, event switcher and "Viewing as" switcher: the accessible name now contains the visible text (WCAG 2.5.3, *label in name*). Voice-control users can say what they see. This was the failure on 26 of 29 routes.
- Admin submissions: the filter selects, the search box, the status select and the version-history icon button now have names. Row buttons say which abstract they act on.
- My reviews: rebuilt on PageHeader, EmptyState, ErrorState and skeleton. Removed the `<button>` nested in `<a>`, which caused a double tab stop and invalid HTML. Fixed a white-on-green badge (2.3:1) in dark mode.
- AppShell: a skip link as the first tab stop; `#main-content` is focusable.

**Dark mode and consistency**

- `ThemeProvider` defaults to `system`. Appearance choice added to the account menu.
- New `[data-paper]` scope in `globals.css` re-declares the light tokens, so print previews (the reviewer certificate) stay paper-white in dark mode without raw colours.
- Admin submissions and the certificate preview: raw amber, emerald, indigo, slate and `bg-white` replaced with status and surface tokens.
- Sentence case across the older admin-reviews tabs and dialogs, admin submissions and the form-builder field types (about 55 strings).

**Performance**

- `next/dynamic` for the dashboard chart (`status-bar-chart.tsx`), the abstract section editor and the guidelines editor. Placeholders reserve the same height, so nothing shifts when they load.
- `sizes` added to the event-header preview images.

**Copy and dates**

- Version history and reviewer certificate now use `formatLongDateTime` / `formatLongDate`, giving "19 November 2026" in Asia/Colombo. Previously they used the browser locale or US format in the server timezone.

## Remaining issues

### Needs a decision or a logic change (not done in a presentation pass)

1. **`yarn lint` exits 1 on 16 errors**, all `react-hooks/set-state-in-effect`. Every page loads its data with `useEffect(() => { void load() })`, and `load` sets loading state synchronously. These existed before this pass and before every commit in the UI series. The fix is a data-loading refactor: either a small `useApiQuery` hook built on `use()` with a promise cache (as the event dashboard already does), or React Query. That changes behaviour on every screen, so it needs its own task. Typecheck and build pass.
2. **Images are `unoptimized`.** Logos and banners come from Supabase straight at full size, so a 375 px phone downloads the original banner. `remotePatterns` already allows `*.supabase.co`, so removing `unoptimized` from `event-hero.tsx` should work. No seeded event has a logo or banner, though, so this couldn't be verified here. Test it with a real banner first, because signed URLs that expire may need `minimumCacheTTL` tuning.
3. **Event dashboard counters read 0** while the event has 5 abstracts and 3 review assignments (audit P0-5). It's an API problem, not UI.
4. **Reminders are logged, not emailed.** The UI says so. GEN-03 email delivery isn't built.

### Accessibility not covered by the automated checks

5. axe only gates **serious and critical** findings, and only the initial state of each page. Dialogs, side panels and dropdowns were checked by hand on the main flows, not scanned. Next step: add axe scans with key dialogs open (COI, confirm submit, invite reviewer, CSV import).
6. **Screen-reader pass** (VoiceOver on iOS, TalkBack on Android) hasn't been done. The review screen's segmented score buttons use `role="radio"` with Enter/Space; arrow-key roving focus within a group isn't implemented.
7. **My reviews** (`/my-reviews`) has no app shell, so there's no way back to an event except the browser back button.

### Older screens still on the pre-redesign layout

8. **Admin submissions** (`components/setup/admin-submissions-page.tsx`): now on tokens and accessible, but still a hand-built table with a modal inspector. It should move to DataTable with cards on mobile, FilterBar and SidePanel, like the Scores tab.
9. **Admin reviews: Reviewers, Rubric and Assignments tabs**: tokens and copy fixed, but they still use the old dialogs and native `<select>` elements, and `sm` buttons (36 px) on desktop. They're fine for pointer input, but should share the redesigned patterns.
10. **Reviewer certificate**: the printable HTML (`lib/services/reviews/certificate.ts`) keeps its own hex colours. It's a standalone print document, not themed UI.

### Inline styles kept on purpose

All 15 are runtime values with no token equivalent: progress widths, grid column counts, chart heights, brand CSS variables (`BrandScope`, `BrandGrid`) and the live colour preview in Settings.
