# Abstract Management System — Requirements v1

Nov 3, 2026 · @Tharindu

## Overview

We are building a multi-tenant SaaS that takes a Sri Lankan symposium from call-for-abstracts to registered presenter: submit, review, decide, register and pay. v1 covers four portals — Submission, Review, Decision and Ticketing — modelled on [Oxford Abstracts](https://oxfordabstracts.com/product/abstract-management-software/) but cut down to what local colleges actually use.

**Who it's for.** Sri Lankan medical colleges running Annual Academic Sessions (College of Surgeons, Orthopaedic, Internal Medicine, Medical Administrators, Transfusion Physicians) and university research symposiums. Each runs 1–2 events a year with a few hundred abstracts.

**What they use today.** Google Forms, email inboxes and free EasyChair. For example, [CMASL](https://cmasl.lk/wp-content/uploads/2024/07/Author-Guidelines-for-Abstract-Submission.pdf) collects abstracts through a Google Form and asks authors to strip their own names from Word files for blind review; [SLCTP](https://easychair.org/cfp/aasslctp2023) uses EasyChair. Registration and payment is handled separately, usually by bank transfer.

**Why they'd switch.** One place for the whole cycle, automatic blinding, ethics-certificate checks, LKR payments with bank-slip uploads, and a one-click abstract book. Oxford Abstracts charges USD 890 per event for its abstract-management plan; we price in LKR with local support.

**Design rules for Tharusha.**

- Everything configurable per event (forms, categories, scoring, ticket prices) — no hard-coded college logic.
- Mobile-first for submitters and reviewers: most consultants will review on their phones between clinics.
- Reuse DocLink's existing Next.js + Supabase stack, auth and role patterns from Menavid and DocLink CRM.

## Scope

v1 ships the four portals plus the exports a college needs to run the day. Anything that only matters for virtual or international conferences is out.

| Area | v1 (build now) | v2 (after first pilot) | Not building |
| --- | --- | --- | --- |
| Submission | Custom forms, structured abstract, ERC upload, co-authors, drafts, edit until deadline, reference numbers | Multi-stage (abstract then full paper), symposium/panel submissions | Title-case tool, AI checks |
| Review | Blind review, scoring rubric, COI, bulk assign by category, auto-save, reminders | Reviewer bidding on topics, score normalisation | Reviewer marketplace |
| Decision | Accept as oral/poster, reject, revise; bulk emails; reviews shown to authors (optional) | Award judging (best oral/poster) | — |
| Ticketing | Ticket types, member/non-member/trainee pricing, early bird, coupons, PayHere, bank-slip upload, receipts | Add-ons (workshops, dinner), group bookings by hospital | Stripe, PayPal |
| Outputs | Abstract book (Word + PDF), Excel exports | Certificates with CPD points, QR check-in at the venue | Printed badges |
| Program | — | Program builder (sessions, halls, times) | Live conference site, networking, poster gallery, exhibitors, mobile app |

## User roles

Eight roles, scoped per organisation and per event. One person can hold several roles (a consultant can submit to one track and review another), so roles attach to an event membership, not to the user account.

| Role | Scope | Can do | Cannot do |
| --- | --- | --- | --- |
| Platform admin (DocLink) | All orgs | Create orgs, manage billing, impersonate for support | — |
| Org admin | One college/university | Create events, add event admins, view all events | — |
| Event admin | One event | Configure everything, see author names, make decisions, see payments | — |
| Track chair | One or more categories | Assign reviewers, view scores, recommend decisions in their category | Final decision unless granted; see other categories |
| Reviewer | Assigned abstracts only | Score, comment, declare COI | See author names (when blind), see other reviewers' scores |
| Finance officer | One event | Verify bank slips, issue receipts, refunds, payment reports | Review or decide abstracts |
| Submitter | Own submissions | Create, edit until deadline, withdraw, see decision, register | See reviewer identity |
| Delegate | Own registration | Buy tickets, download receipt | — |

Submitters and delegates sign up themselves with email + OTP or password. Everyone else is invited by email by an admin.

## Module 1 — Event setup

An event admin should be able to stand up a new Annual Academic Sessions in under an hour, or clone last year's event in five minutes.

| ID | Requirement | Priority |
| --- | --- | --- |
| EVT-01 | Create an event: name, edition (e.g. "54th Annual Academic Sessions"), venue, dates, logo, banner, contact email and phone | Must |
| EVT-02 | Public event page at `<org>.<domain>/<event>` with call for abstracts, guidelines (rich text + PDF upload), key dates and a Submit button | Must |
| EVT-03 | Key dates: submission open, submission close, review deadline, notification date, early-bird end, registration close. Each date drives portal state automatically (Asia/Colombo time) | Must |
| EVT-04 | Categories/tracks (e.g. Trauma, Spine, Paediatric Orthopaedics) with a chair assigned per track | Must |
| EVT-05 | Submission types (Original research, Clinical audit, Case report, Quality improvement, Oration), each with its own form and word limit | Must |
| EVT-06 | Presentation types for decisions: Oral, Poster, Oral or poster | Must |
| EVT-07 | Eligibility rules: max abstracts per author (e.g. 2), at least one author must be a member, presenting author must register | Must |
| EVT-08 | Member list import (CSV: name, membership number, SLMC number, email) used to verify member pricing and eligibility | Should |
| EVT-09 | Clone an event with all settings, forms, templates and reviewer pool, without submissions | Must |
| EVT-10 | Manually extend a deadline for one submitter without reopening the whole call | Should |
| EVT-11 | Dashboard: submissions by status and category, reviews done vs pending, registrations and revenue | Must |

## Module 2 — Submission portal

The portal replaces the Google Form and the "remove your name from the Word file" instruction: authors fill structured fields, and the system keeps author details apart from the abstract body so blinding is automatic.

Local guidelines set the defaults. [SIMCON 2026](https://slcim.lk/wp-content/uploads/SIMCON-Abstract-guideline-final-1.pdf) asks for a 300-word IMRaD abstract with no tables, figures or references, surname-plus-initials author names with the presenter marked, numbered affiliations, a compulsory ERC certificate, a prior-publication declaration and a reference number for every abstract. CMASL adds a two-abstract cap per author, a membership rule and up to three keywords.

| ID | Requirement | Priority |
| --- | --- | --- |
| SUB-01 | Form builder per submission type: text, long text, dropdown, checkbox, radio, file upload, number, date; required/optional; help text; conditional show/hide | Must |
| SUB-02 | Structured abstract fields with default sections Introduction, Objectives, Methods, Results, Conclusions (editable per type, e.g. case reports use Background, Case, Discussion) | Must |
| SUB-03 | Live word counter across all abstract sections with a hard limit (default 300, title and keywords excluded) | Must |
| SUB-04 | Block tables and images in the abstract body; allow bold, italic, superscript, subscript and Greek/medical symbols | Must |
| SUB-05 | Authors list: surname, initials, email, institution, designation, SLMC number (optional), membership number (optional). Reorder by drag; mark one presenting and one corresponding author | Must |
| SUB-06 | Affiliations entered once and linked to authors by number, rendered as superscripts in the abstract book | Must |
| SUB-07 | Keywords (configurable max, default 3) | Must |
| SUB-08 | Ethics: ERC approval yes / exempt / not applicable, approving institution, reference number, and PDF upload of the certificate or exemption letter. Required for research and audits | Must |
| SUB-09 | Declarations: previously presented/published (with details), all authors consented, no identifiable patient data, conflict of interest. Each a required checkbox | Must |
| SUB-10 | Preferred presentation type (oral, poster, either) and category selection | Must |
| SUB-11 | Save as draft; auto-save every 30 seconds | Must |
| SUB-12 | On submit: unique reference number (e.g. `SLOA26-0042`), confirmation email with a PDF copy of the abstract | Must |
| SUB-13 | Edit and withdraw until the deadline; every edit stored as a version; admin sees the change history | Must |
| SUB-14 | Enforce eligibility from EVT-07: block a 3rd abstract from the same presenting author; warn if no author matches the member list | Must |
| SUB-15 | Duplicate check: warn the admin when two abstracts have near-identical titles | Should |
| SUB-16 | Submitter dashboard: all my submissions, status, decision, reviewer comments (if released), and "Register now" when accepted | Must |
| SUB-17 | Co-authors get a notification email that they were listed, with a link to flag errors | Should |

## Module 3 — Review portal

Reviewers are senior consultants with little time, so the review screen must work on a phone, save every keystroke and need no training. Oxford Abstracts leads with the same three things: auto-save, bulk assignment by category and scheduled reminders.

| ID | Requirement | Priority |
| --- | --- | --- |
| REV-01 | Reviewer pool per event: invite by email, record expertise categories, max load (e.g. 20 abstracts) | Must |
| REV-02 | Reviewer accepts invitation and agrees to confidentiality before seeing any abstract | Must |
| REV-03 | Blind mode per event: none, single-blind (reviewer hidden from author), double-blind (author names, affiliations and uploaded files hidden from reviewer). ERC certificate visible only to admins | Must |
| REV-04 | Scoring rubric builder: criteria with name, description, scale (e.g. 1–5 or 1–10) and weight; optional free-text comments to author and confidential comments to committee | Must |
| REV-05 | Recommendation field per review: Accept oral / Accept poster / Reject / Revise | Must |
| REV-06 | Assignment: manual, bulk by category, or auto-assign N reviewers per abstract (default 2) balancing load and skipping same-institution reviewers | Must |
| REV-07 | Conflict of interest button on each abstract; declaring returns it to the chair for reassignment and records the reason | Must |
| REV-08 | Review screen: abstract on one side, form on the other (stacked on mobile); auto-save; next/previous abstract | Must |
| REV-09 | Reviewer dashboard: assigned, in progress, done, deadline countdown | Must |
| REV-10 | Admin/chair progress view: % complete per reviewer and per category; one-click reminder; scheduled automatic reminders (e.g. 7 and 2 days before deadline) | Must |
| REV-11 | Score table per abstract: each reviewer's scores, weighted total, average, standard deviation; flag abstracts where reviewers disagree by more than a set gap | Must |
| REV-12 | Reviewers cannot see other reviewers' scores unless the admin turns it on | Should |
| REV-13 | Reassign or add a third reviewer to a disputed abstract | Should |
| REV-14 | Reviewer certificate / letter of appreciation export | Could |

## Module 4 — Decisions and notifications

Decisions are made in bulk from a ranked list, then released to authors in one send. An accepted abstract is only confirmed for the programme and abstract book once its presenting author has registered and paid.

| ID | Requirement | Priority |
| --- | --- | --- |
| DEC-01 | Decision board: all abstracts ranked by weighted average score, filter by category, type, score range, disagreement flag | Must |
| DEC-02 | Set decision per abstract or in bulk: Accept oral, Accept poster, Reject, Revisions requested, Waitlist | Must |
| DEC-03 | Set cut-offs (e.g. score ≥ 7 oral, 5–6.9 poster) and apply them as provisional decisions the admin can override | Should |
| DEC-04 | Decisions stay hidden from authors until the admin clicks Release; release can be per category | Must |
| DEC-05 | Decision email templates per outcome with merge fields (name, title, reference, presentation type, registration link, deadline) | Must |
| DEC-06 | Optionally release anonymised reviewer comments to authors | Should |
| DEC-07 | Revisions requested: reopens the submission for that author with a new deadline; goes back to the same reviewers | Should |
| DEC-08 | Accepted authors confirm or decline the slot; declined slots offered to the waitlist | Should |
| DEC-09 | Status becomes Confirmed automatically when the presenting author's registration is paid; unregistered accepted abstracts flagged by a set date | Must |
| DEC-10 | Abstract book export (Word and PDF): cover, contents by category, each abstract with reference number, title, authors (presenter underlined), superscript affiliations and body; only Confirmed abstracts | Must |
| DEC-11 | Excel export of all submissions with authors, scores, decisions and registration status | Must |

Submission status flow, which Tharusha should implement as a state machine:

&#91;embedded content: submission status flow · 9 states\]

Revisions loop back to Submitted and the same reviewers; a waitlisted abstract moves to Accepted when a slot frees. Authors can withdraw from Draft or Submitted at any time before a decision.

## Module 5 — Ticketing and payments

Registration has to accept the two ways Sri Lankan delegates actually pay: card online and bank transfer with a slip. Oxford Abstracts only integrates Stripe and PayPal, neither of which serves local merchants well; we use PayHere, whose [Checkout API](https://support.payhere.lk/api-&-mobile-sdk/checkout-api) takes LKR and USD and calls back a notify URL with a signed payment status.

| ID | Requirement | Priority |
| --- | --- | --- |
| TKT-01 | Ticket types with price, currency (LKR, or USD for foreign delegates), quantity cap, sale window and who may buy (e.g. Member, Non-member, Trainee/Registrar, Medical student, Foreign delegate, Accompanying person) | Must |
| TKT-02 | Early-bird pricing that switches automatically on the EVT-03 date | Must |
| TKT-03 | Member price only when the email or membership number matches the imported member list; otherwise admin approval | Must |
| TKT-04 | Registration form: title, full name, name for certificate, SLMC number, institution, designation, phone, email, dietary preference | Must |
| TKT-05 | Coupon codes: % or fixed, usage limit, expiry, restricted to ticket types | Must |
| TKT-06 | Online card payment via PayHere sandbox and live; verify the signature on the server callback before marking paid | Must |
| TKT-07 | Bank transfer: show the college's account details, delegate uploads the slip (image/PDF) and reference; status Pending verification | Must |
| TKT-08 | Finance officer queue: view slip, approve or reject with reason; approval triggers receipt and confirmation email | Must |
| TKT-09 | Pay at venue option, marked paid by the finance officer on the day | Should |
| TKT-10 | Auto-numbered PDF receipt with the college's name, address and logo | Must |
| TKT-11 | Link registration to submissions: accepted presenting authors see "Register now"; paying updates the abstract to Confirmed (DEC-09) | Must |
| TKT-12 | Refunds and cancellations recorded manually with reason (no automatic gateway refunds in v1) | Should |
| TKT-13 | Reports: registrations by ticket type, revenue by payment method, outstanding bank slips; Excel export | Must |
| TKT-14 | Add-ons (pre-congress workshop, gala dinner) and group registration paid by one hospital | Could (v2) |

Open question: does the college take payments into its own PayHere merchant account, or does DocLink collect and remit? Own account per college is simpler legally and is the default assumed here.

## Cross-cutting requirements

These apply across all modules and are where most of the polish — and most of the trust with a college — comes from.

| ID | Requirement | Priority |
| --- | --- | --- |
| GEN-01 | Multi-tenancy: every table carries `org_id`; Supabase row-level security so one college can never read another's data | Must |
| GEN-02 | Branding per event: logo, primary colour, email sender name; DocLink shown only as "Powered by" | Must |
| GEN-03 | Email engine: editable templates with merge fields for every system email; schedule bulk emails; log every email sent with delivery status | Must |
| GEN-04 | Bulk email to filtered groups (e.g. all accepted poster presenters who haven't registered) | Must |
| GEN-05 | SMS for critical events (submission received, decision released, payment confirmed) through a local SMS gateway | Should |
| GEN-06 | File storage: PDFs and images up to 5 MB, virus-scan on upload, private by default, signed URLs | Must |
| GEN-07 | Audit log of admin actions: decision changes, deadline extensions, payment approvals, role changes | Must |
| GEN-08 | Data protection: consent text at sign-up, data export and deletion on request, aligned with Sri Lanka's Personal Data Protection Act | Must |
| GEN-09 | Times stored in UTC, shown in Asia/Colombo; dates as DD Month YYYY | Must |
| GEN-10 | Mobile-responsive on all screens; submission and review fully usable at 375 px width | Must |
| GEN-11 | Performance: handle 1,000 submissions and 50 concurrent users per event, with the deadline-night spike in mind | Must |
| GEN-12 | Daily backups; 99.5% uptime target during open submission windows | Must |
| GEN-13 | English only in v1; data model ready for Sinhala and Tamil labels later | Could |
| GEN-14 | Certificates (attendance, presentation, reviewer) with CPD points and QR verification | Could (v2) |

## Data model outline

A starting schema for Supabase; Tharusha should refine names and add indexes. Every event-level table carries `org_id` and `event_id` for row-level security.

| Table | Key fields | Notes |
| --- | --- | --- |
| organisations | name, slug, logo, address, payhere\_merchant\_id, bank\_details | One per college/university |
| users | email, phone, full\_name, slmc\_no | Supabase auth |
| event\_roles | user\_id, event\_id, role, category\_ids | A user can hold several roles per event |
| events | org\_id, name, slug, venue, key dates, blind\_mode, settings JSON | Cloneable |
| categories | event\_id, name, chair\_user\_id | Tracks |
| submission\_types | event\_id, name, word\_limit, sections JSON, requires\_erc | Form defined by `form_fields` |
| form\_fields | submission\_type\_id, label, type, options, required, order, condition | Form builder |
| members | org\_id, name, membership\_no, slmc\_no, email | Imported list |
| submissions | event\_id, ref\_no, submitter\_id, type\_id, category\_id, title, status, preferred\_type, decision, presentation\_type | Status = state machine |
| submission\_versions | submission\_id, content JSON, created\_at | Full snapshot per edit |
| authors | submission\_id, surname, initials, email, institution, affiliation\_nos, is\_presenting, is\_corresponding, order | Hidden in blind mode |
| affiliations | submission\_id, number, text | Superscript numbers |
| files | owner table/id, kind (erc, slip, abstract\_pdf), path | Private bucket |
| rubric\_criteria | event\_id, name, description, scale\_min, scale\_max, weight | Per event |
| review\_assignments | submission\_id, reviewer\_id, status, due\_at, coi\_reason | One row per reviewer per abstract |
| review\_scores | assignment\_id, criterion\_id, score |  |
| reviews | assignment\_id, recommendation, comment\_author, comment\_committee |  |
| email\_templates / email\_log | event\_id, key, subject, body / to, template, status, sent\_at |  |
| ticket\_types | event\_id, name, price, currency, eligibility, cap, sale window, early\_bird\_price |  |
| coupons | event\_id, code, type, value, limit, expires\_at |  |
| registrations | event\_id, user\_id, ticket\_type\_id, attendee details, status, total |  |
| payments | registration\_id, method (payhere, bank, venue), amount, gateway\_ref, slip\_file\_id, verified\_by, status |  |
| audit\_log | org\_id, actor\_id, action, entity, before, after |  |

## Build phases

About 14 weeks with Tharusha building full-time and Amadie testing each phase as it lands. Build in this order: submission must work before anything else, because a pilot college can open its call for abstracts while review and ticketing are still being finished.

| Phase | Weeks | Delivers | Done when |
| --- | --- | --- | --- |
| 1. Foundation | 1–2 | Auth, organisations, events, roles, RLS, event page, key dates, categories | Org admin creates an event and invites an event admin; a second org cannot see it |
| 2. Submission | 3–5 | SUB-01 to SUB-17, email engine basics | A submitter completes a 300-word IMRaD abstract with 4 authors and an ERC PDF on a phone, gets a reference number and PDF copy, and is blocked at the deadline |
| 3. Review | 6–8 | REV-01 to REV-13 | 50 test abstracts auto-assigned to 10 reviewers, 2 each, no same-institution pairs; a double-blind reviewer sees no author data anywhere, including in file names |
| 4. Decisions | 9–10 | DEC-01 to DEC-11 | Admin applies cut-offs, releases decisions to one category, and exports an abstract book in Word that a college secretary would print without edits |
| 5. Ticketing | 11–13 | TKT-01 to TKT-13 | Sandbox PayHere payment and an approved bank slip both produce receipts and flip the linked abstract to Confirmed |
| 6. Pilot hardening | 14 | Load test, backups, audit log, bug fixes | 1,000 submissions and 50 concurrent users without errors; pilot college signs off on a full dry run |

**Process for Tharusha.** Break each requirement ID into tasks, log time against it in Clockify, demo at the Friday review, and record decisions in the development SOP as he goes. Amadie writes test cases per requirement ID from week 3.

**Open questions for Thari before week 3.**

- [ ] Which college is the pilot, and what is its next submission deadline?
- [ ] Pilot pricing: per event, per year, or free first event in exchange for a case study?
- [ ] Own PayHere merchant account per college, or DocLink collects and remits?
- [ ] Product name and domain
