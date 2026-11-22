# Abstract Management System — User & Manual Testing Manual
## Modules 1, 2, 3 & 4: Event Setup, Submission, Review, and Decisions & Notifications

This manual provides complete step-by-step instructions for testing and operating **Module 1 (Event Setup)**, **Module 2 (Submission Portal)**, **Module 3 (Review Portal)**, and **Module 4 (Decisions & Notifications)**, in accordance with the system specification (`Abstract Management System — Requirements v1.md`).

---

## 1. Quick Start & Prerequisites

### 1.1 Start Development Server
Open your terminal in the project directory:
```bash
# 1. Ensure dependencies are installed and database schema is generated
yarn install
yarn prisma:generate

# 2. Seed default admin, organisation, and sample data
yarn prisma:seed

# 3. (Optional) Seed role-specific test accounts (reviewer, track chair, event admin)
yarn seed:roles

# 4. Start Next.js development server
yarn dev
```
The application will be running at **`http://localhost:3000`**.

### 1.2 Test Credentials & Role Portals
| Role | Email | Password | Primary Portal URL |
|---|---|---|---|
| **Platform / Org Admin** | `admin@example.com` | `change-me-now` | `http://localhost:3000/login` |
| **Event Admin** | `eventadmin@example.com` | `change-me-now` | `http://localhost:3000/org/demo-college/events/aas-2026/dashboard` |
| **Track Chair** | `chair@example.com` | `change-me-now` | `http://localhost:3000/org/demo-college/events/aas-2026/reviews` |
| **Reviewer** | `reviewer@example.com` | `change-me-now` | `http://localhost:3000/demo-college/aas-2026/reviews` or `/my-reviews` |
| **Submitter / Author** | `submitter@example.com` | `change-me-now` | `http://localhost:3000/demo-college/aas-2026/my-submissions` |
| **Public Event Page** | Anonymous / All users | N/A | `http://localhost:3000/demo-college/aas-2026` |
| **API Swagger UI** | Public / Dev mode | N/A | `http://localhost:3000/swagger-ui` |

---

## 2. Module 1: Event Setup — Manual Test Guide

### Test Case 1.1: Create a New Event (EVT-01, EVT-02)
1. **Navigate to:** `http://localhost:3000/login`.
2. Sign in with **Admin credentials** (`admin@example.com` / `change-me-now`).
3. You will be redirected to the organisation workspace (`/org/demo-college`).
4. Click **"New Event"** (or select an existing event).
5. Fill in the event details:
   - **Name:** `Annual Academic Sessions 2026`
   - **Slug:** `aas-2026`
   - **Edition:** `54th Annual Academic Sessions`
   - **Venue:** `BMICH, Colombo, Sri Lanka`
   - **Contact Email:** `academic@democollege.lk`
   - **Contact Phone:** `+94 11 269 1111`
   - **Dates:** Set event start and end dates.
6. **Upload Assets:** Upload a logo (PNG/JPG) and a banner image (JPG/WebP).
7. Click **"Save Changes"**.
8. **Verify:**
   - Open a new tab and visit the public event page: `http://localhost:3000/demo-college/aas-2026`.
   - Verify the logo, banner, edition, venue, and contact details appear properly.

---

### Test Case 1.2: Configure Key Dates & Automatic Portal State (EVT-03)
1. In the Event Admin portal, navigate to **Setup** -> **Key Dates**.
2. Configure the following dates (all interpreted in `Asia/Colombo` timezone):
   - **Submission Open:** Set to yesterday (or a past time).
   - **Submission Close:** Set to 14 days in the future.
   - **Review Deadline:** Set to 30 days in the future.
   - **Notification Date:** Set to 45 days in the future.
   - **Early-bird End:** Set to 50 days in the future.
   - **Registration Close:** Set to 60 days in the future.
3. Click **"Save Key Dates"**.
4. **Verify Portal State:**
   - Look at the **Portal State Chip**; it should display `Submissions Open` (green badge).
   - Visit the public page (`/demo-college/aas-2026`); the **"Submit abstract"** button should be enabled.
   - *Test Close Date:* Temporarily change "Submission Close" to a past date. Save, then refresh the public page. The button switches to disabled with **"Submissions closed"**. Revert the date back to open.

---

### Test Case 1.3: Tracks & Categories (EVT-04)
1. Click **Categories** in the admin sidebar.
2. Add or inspect the categories:
   - `Trauma & Emergency Orthopaedics`
   - `Spine & Spinal Deformity`
   - `Paediatric Orthopaedics`
3. Assign a Track Chair user (e.g. `chair@example.com`).
4. Reorder the categories using sort order.
5. **Verify:** Categories appear in the table and are available in the submission wizard and reviewer assignment filters.

---

### Test Case 1.4: Submission Types & Default IMRaD Sections (EVT-05, EVT-06)
1. Click **Submission Types** in the admin sidebar.
2. Notice the default seeded submission types (e.g. *Original Research*, *Clinical Audit*, *Case Report*).
3. Click **Edit** on *Original Research*:
   - Set **Word limit** to `300`.
   - Toggle **"Ethics (ERC) declaration required"** to `ON`.
   - Click **Save Changes**.
4. **Verify:** The card displays `Word limit: 300` and `Ethics (ERC) declaration required`.

---

### Test Case 1.5: Eligibility Rules (EVT-07)
1. Click **Eligibility** in the admin sidebar.
2. Set:
   - **Maximum abstracts per author (as presenter):** `2`
   - **Require at least one author to be a member:** Check `ON` (or `OFF` for testing open events).
   - **Presenting author must register:** Check `ON`.
3. Click **Save Eligibility Rules**.

---

### Test Case 1.6: Member List CSV Import (EVT-08)
1. Click **Members** in the admin sidebar.
2. Prepare a test CSV file `members.csv`:
   ```csv
   name,membership_no,slmc_no,email
   Dr. Sunil Perera,M-1001,24500,sunil.perera@example.com
   Dr. Anoma Silva,M-1002,28900,anoma.silva@example.com
   ```
3. Drag and drop `members.csv` into the dropzone.
4. Click **Import Members**.
5. **Verify:** The members table populates with the 2 records.

---

### Test Case 1.7: Deadline Extension for Single Submitter (EVT-10)
1. In the admin sidebar, click **Settings** -> **Deadline Extensions**.
2. Select a submitter user from the dropdown.
3. Select an extension date (e.g., 3 days after regular deadline).
4. Enter reason: `Hospital on-call emergency duty`.
5. Click **Grant Extension**.
6. **Verify:** Extension appears in the table. Even if the event deadline closes, this specific submitter can still edit or submit.

---

### Test Case 1.8: Event Cloning (EVT-09)
1. Go to **Settings** -> **Clone Event**.
2. Enter **New Event Name:** `Annual Academic Sessions 2027` and **Slug:** `aas-2027`.
3. Click **Clone Event**.
4. **Verify:** You are redirected to the new cloned event. All categories, submission types, and eligibility rules are replicated, while submissions and audit logs start fresh with 0 items.

---

### Test Case 1.9: Event Admin Dashboard (EVT-11)
1. In the admin sidebar, navigate to **Dashboard**.
2. **Verify Metrics:**
   - Total Submissions count and breakdown by status (Draft, Submitted, Under Review, Accepted, etc.).
   - Submissions by category/track chart.
   - Review progress stats (Completed vs Pending assignments).
   - Registrations and revenue counter (ready for Module 5).

---

## 3. Module 2: Submission Portal — Manual Test Guide

### Test Case 2.1: Custom Form Builder Configuration (SUB-01, SUB-02)
1. In the Event Admin, navigate to **Submission Types**.
2. On the **Original Research** card, click **"Edit form fields & sections"**.
3. **Abstract Sections Tab (SUB-02):**
   - Verify the default sections: *Introduction*, *Objectives*, *Methods*, *Results*, *Conclusions*.
   - Click **Add Section** -> Enter `Funding & Acknowledgements` -> Click **Add Section**.
   - Reorder sections using **Move Up** / **Move Down**.
   - Click **"Save Sections"**.
4. **Custom Form Fields Tab (SUB-01):**
   - Click **"Add Field"**.
   - **Label:** `Clinical Trial Registry Number` | **Type:** `Short Text` | **Required:** `OFF`.
   - Click **"Add Field"** again:
   - **Label:** `Study Setting` | **Type:** `Dropdown Select` | **Options:** `Tertiary Referral Hospital, Base Hospital, Multi-centre, Community Setting` | **Required:** `ON`.
5. Close the dialog and verify fields are saved.

---

### Test Case 2.2: Author Submission Wizard (SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SUB-08, SUB-09, SUB-10, SUB-11)
1. Sign in as author (`submitter@example.com` / `change-me-now`).
2. Visit `http://localhost:3000/demo-college/aas-2026/submit`.
3. **Step 1 — Details & Duplicate Check (SUB-10, SUB-15):**
   - Select **Submission Type:** `Original Research`.
   - Select **Category:** `Trauma & Emergency Orthopaedics`.
   - Select **Preferred Presentation:** `Oral presentation preferred`.
   - Title: `Management of open tibial fractures: a prospective multicentre study in Sri Lanka`.
   - Notice that if an existing submission has a very similar title, a duplicate warning banner appears (SUB-15).
   - Click **Continue to Authors**.
4. **Step 2 — Authors & Numbered Affiliations (SUB-05, SUB-06):**
   - Add Affiliation #1: `Department of Orthopaedics, National Hospital of Sri Lanka`.
   - Add Affiliation #2: `Faculty of Medicine, University of Colombo`.
   - Add Author 1: Surname `Perera`, Initials `S.K.`, Email `submitter@example.com`, SLMC `24500`, check affiliations `[1, 2]`, Presenting = `ON`, Corresponding = `ON`.
   - Add Author 2: Surname `Silva`, Initials `A.`, Email `anoma.silva@example.com`, check affiliation `[1]`.
   - Test drag-and-drop / arrow reordering.
   - Click **Continue to Abstract Body**.
5. **Step 3 — Abstract Sections & Word Counter (SUB-02, SUB-03, SUB-04, SUB-07):**
   - Fill in Introduction, Objectives, Methods, Results, Conclusions.
   - Use the **Symbols** toolbar button to insert Greek/medical characters ($\alpha, \beta, \pm, \le, \mu\text{g}$).
   - Test pasting a table or image: verify a warning toast blocks the paste (SUB-04).
   - Check the **Word Counter**: verify it counts words across sections excluding title and keywords, turning red if > 300 words (SUB-03).
   - Add Keywords: `Tibial fracture`, `Fixation`, `Outcomes` (SUB-07).
   - Select custom field **Study Setting:** `Tertiary Referral Hospital`.
   - Click **Continue to Ethics & Declarations**.
6. **Step 4 — Ethics (ERC) & Declarations (SUB-08, SUB-09):**
   - ERC Status: `ERC Approved`.
   - Institution: `ERC, National Hospital of Sri Lanka` | Reference: `ERC-2024-889`.
   - Upload ERC Certificate PDF (SUB-08).
   - Check all mandatory declarations: Author consent, Patient privacy, No COI (SUB-09).
   - Click **Review Abstract**.
7. **Step 5 — Verification & Submit (SUB-11, SUB-12):**
   - Notice the **Auto-save** indicator ("Draft saved [time]") (SUB-11).
   - Verify formatted preview: presenter underlined, superscript affiliations, Greek symbols preserved.
   - Click **Submit Abstract**.
   - **Verify:** Celebration modal appears displaying the unique Reference Number (e.g. `AAS26-0001`) (SUB-12).

---

### Test Case 2.3: Submitter Dashboard & Lifecycle Actions (SUB-13, SUB-16, SUB-17)
1. Go to **My submissions** (`/demo-college/aas-2026/my-submissions`).
2. Verify your submission card appears with its Ref Number, Title, Presenter, and **Submitted** status badge.
3. Click **History** -> Inspect the Version 1 snapshot timestamp (SUB-13).
4. If needed, click **Withdraw** -> Verify modal confirms and marks status **Withdrawn**.

---

## 4. Module 3: Review Portal — Manual Test Guide

### Test Case 3.1: Reviewer Pool & Invitations (REV-01)
1. Sign in as **Event Admin** (`eventadmin@example.com` or `admin@example.com`).
2. Navigate to **Reviews** in the sidebar (`/org/demo-college/events/aas-2026/reviews`).
3. Click the **Reviewers** tab.
4. Click **Invite Reviewer**:
   - **Email:** `consultant.ortho@example.com`
   - **Full Name:** `Dr. Kithsiri Senanayake`
   - **Expertise Categories:** Select `Trauma & Emergency Orthopaedics`.
   - **Max Review Load:** `15` abstracts.
   - Click **Send Invitation**.
5. **Verify:** Dr. Senanayake appears in the Reviewers table with status `Pending Invite`.

---

### Test Case 3.2: Reviewer Confidentiality Agreement (REV-02)
1. Open an Incognito window and sign in as the invited reviewer (e.g. `reviewer@example.com` / `change-me-now`).
2. Navigate to the Reviewer Portal (`/demo-college/aas-2026/reviews`).
3. If this is the reviewer's first visit, the **Confidentiality Agreement Modal** appears:
   - *"I agree to maintain strict confidentiality of all unpublished manuscripts and data..."*
4. Click **"I Agree & Continue"**.
5. **Verify:** The modal dismisses and the reviewer is granted access to their assigned abstracts.

---

### Test Case 3.3: Blind Review Modes (REV-03, REV-12)
1. In Event Admin, navigate to **Settings**.
2. Notice the **Blind Review Mode** setting:
   - `Double-blind (Default)`: Reviewers see neither author names nor affiliations. File uploads (like ERC letters) are hidden from reviewers.
   - `Single-blind`: Reviewer identity is hidden from authors; authors are visible to reviewers.
   - `None`: Open review.
3. As `reviewer@example.com`, inspect an assigned abstract:
   - **Verify (Double-blind):** Author names, institutions, and affiliations are completely omitted from the review screen. File attachments with names are inaccessible.
   - Reviewers cannot see scores submitted by other reviewers unless the admin score-sharing option is explicitly enabled (REV-12).

---

### Test Case 3.4: Scoring Rubric Builder (REV-04, REV-05)
1. In Admin Reviews (`/org/demo-college/events/aas-2026/reviews`), click the **Rubric** tab.
2. Review the default criteria or add a custom criterion:
   - **Name:** `Originality & Scientific Merit`
   - **Description:** `Novelty of hypothesis and relevance to local practice`
   - **Scale:** `1 to 10`
   - **Weight:** `2.0`
3. Add a second criterion:
   - **Name:** `Methodology & Study Design` | **Scale:** `1 to 10` | **Weight:** `1.5`.
4. Reorder criteria using the reorder buttons.
5. **Verify:** Rubric criteria are saved and will appear in the reviewer scoring form with their assigned weights.

---

### Test Case 3.5: Assignment Engine: Manual, Bulk, and Auto-Assign (REV-06, REV-13)
1. In Admin Reviews, click the **Assignments** tab.
2. **Bulk Assign by Track:**
   - Click **Bulk Assign by Category**.
   - Select Track: `Trauma & Emergency Orthopaedics`.
   - Select Reviewers: Check `Dr. Nirmala Wijesinghe` and `Dr. Chaminda Fernando`.
   - Click **Assign to All Track Abstracts**.
3. **Auto-Assign Engine (REV-06):**
   - Click **Auto-Assign Reviewers**.
   - Set **Reviewers per abstract:** `2`.
   - Toggle **Exclude Same-Institution Reviewers:** `ON` (prevents reviewers from scoring abstracts from their own hospital/university).
   - Toggle **Balance Reviewer Load:** `ON` (respects `maxLoad`).
   - Click **Run Auto-Assignment**.
   - **Verify:** System assigns reviewers across abstracts, showing summary of assignments created.
4. **Disputed Abstract 3rd Reviewer (REV-13):**
   - For an abstract flagged with reviewer disagreement, click **Assign Additional Reviewer** to add a third adjudicating reviewer.

---

### Test Case 3.6: Conflict of Interest (COI) Declaration (REV-07)
1. Sign in as `reviewer@example.com` and open `/demo-college/aas-2026/reviews`.
2. Click on an assigned abstract to open the review screen.
3. Click the **Declare Conflict of Interest** button (top right).
4. Enter reason: `I was a collaborator on an earlier phase of this project`.
5. Click **Confirm Conflict**.
6. **Verify:**
   - The abstract is removed from the reviewer's active queue.
   - In the Admin Review dashboard, the assignment status switches to `Conflict`, and it returns to the track chair for reassignment.

---

### Test Case 3.7: Side-by-Side Review Screen & Auto-Save (REV-08, REV-09)
1. Sign in as `reviewer@example.com`.
2. Navigate to `/demo-college/aas-2026/reviews` (Reviewer Dashboard):
   - Notice KPI cards: `Assigned`, `In Progress`, `Completed`, and Deadline Countdown (REV-09).
3. Click **"Review Abstract"** on an assigned submission.
4. **Inspect Review Layout (REV-08):**
   - **Desktop (≥1024px):** Abstract text on the left panel; scoring rubric and recommendation form on the right panel.
   - **Mobile (375px):** Stacked responsive layout with sticky navigation controls.
5. **Score the Abstract:**
   - Enter scores for each rubric criterion (e.g. 8/10, 7/10).
   - Select **Recommendation (REV-05):** Choose `Accept Oral`.
   - Enter **Comments to Authors:** *"Well-written paper with sound methodology. Clarify sample size in Results."*
   - Enter **Confidential Comments to Committee:** *"Strong candidate for the trauma session."*
6. **Auto-save Check:**
   - Watch the auto-save indicator confirm saves in the background.
7. Click **"Submit Review"**.
8. **Verify:** Abstract status updates to `Completed`. Click **Next Abstract &rarr;** to continue reviewing.

---

### Test Case 3.8: Review Progress & Disagreement Scores Table (REV-10, REV-11)
1. Switch back to **Admin Reviews** (`/org/demo-college/events/aas-2026/reviews`).
2. **Progress Tab (REV-10):**
   - View overall % completion progress bar.
   - Reviewer progress list shows % complete per consultant.
   - Click **Send Reminder** next to an overdue reviewer to queue a reminder email.
3. **Scores Table Tab (REV-11):**
   - View the ranked list of all reviewed abstracts.
   - Inspect columns: `Completed Reviews`, `Weighted Average Score`, `Standard Deviation (SD)`, `Score Gap`.
   - **Dispute Flag Check:** If two reviewers' scores differ by $\ge 2.0$ points (the default threshold), a prominent amber **"Disputed"** badge appears with the score gap.

---

### Test Case 3.9: Reviewer Certificate of Appreciation Export (REV-14)
1. In Admin Reviews, go to the **Reviewers** tab.
2. Locate a reviewer who has completed their assigned reviews.
3. Click **"Certificate"** (or certificate icon).
4. A preview modal displays the formal Certificate of Appreciation with:
   - College Name and Event Edition.
   - Reviewer's Full Name.
   - Number of abstracts reviewed.
   - Date and formal citation.
5. Click **"Print / Download PDF"** to verify printable output.

---

## 5. Module 4: Decisions & Notifications — Manual Test Guide

### Test Case 4.1: Access the Decision Board (DEC-01)
1. Sign in as **Event Admin** (`eventadmin@example.com` or `admin@example.com`).
2. In the sidebar under **Abstracts**, click **Decisions** (`/org/demo-college/events/aas-2026/decisions`).
3. **Verify Decision Board Header & KPI Cards:**
   - **Total Submissions** (with decidable count).
   - **Pending Release** (counter of decisions made but hidden from authors).
   - **Accepted (Oral)** and **Accepted (Poster)** counters.
   - **Disputed** (counter of abstracts where reviewers differed by $\ge$ threshold).
   - **Unregistered** (accepted abstracts past the registration due date).
4. **Test Quick View Filters:**
   - Click **"Pending Release"** -> filters only submissions with decisions awaiting publication.
   - Click **"Disputed"** -> filters only abstracts with disagreement flags.
   - Click **"Unregistered"** -> filters accepted abstracts needing registration follow-up.
   - Click **"Declined Slots"** -> filters abstracts whose authors declined their slot.
   - Click **"All"** -> resets to all submissions.
5. **Inspect Row Details:**
   - Notice each submission shows its rank (#1, #2...), reference number, title, weighted average score, reviewer count, standard deviation, and current decision badge.

---

### Test Case 4.2: Inspect an Abstract & Set Single Decision (DEC-02)
1. On the Decision Board, click on any submission title or click **"Review & Decide &rarr;"**.
2. The **SidePanel** opens:
   - **Top section:** Reference number, title, presenter, track, and submission type.
   - **Peer Review Breakdown:** Average score (e.g. `8.25`), standard deviation, and dispute badge if applicable.
   - **Reviewer Details:** For each completed review, inspect Reviewer Name, Individual Weighted Score, Recommendation, Comments to Authors, and Confidential Committee Notes.
3. **Record Decision:**
   - Under **Set Decision**, select **Outcome:** `Accept Oral Presentation`.
   - Enter **Internal Note:** *"High priority for Plenary Session 1"*.
   - Click **"Save Decision"**.
4. **Verify:**
   - SidePanel closes with a success toast.
   - The submission row now displays a green **"Accept Oral"** badge.
   - The **Pending Release** counter increments by 1.
   - *Note:* The decision is provisional and **hidden from the author** until released (DEC-04).

---

### Test Case 4.3: Bulk Decisions Workflow (DEC-02)
1. In the Decision Board table, select the checkboxes for 3 different submissions.
2. Notice the purple selection toolbar appear: **"3 selected"**.
3. Click **"Set Decision"**:
   - In the modal, select **Outcome:** `Accept Poster Presentation`.
   - Enter **Note (Optional):** *"Allocated to Poster Hall B"*.
   - Click **"Apply to 3 Abstracts"**.
4. **Verify:**
   - Success toast: *"Applied decision to 3 abstracts"*.
   - All 3 rows update to show the teal **"Accept Poster"** badge.
   - The Pending Release counter updates.

---

### Test Case 4.4: Score Cut-offs: Preview & Apply Provisional Decisions (DEC-03)
1. In the Decisions portal, click the **Cut-offs** tab (`#cutoffs`).
2. **Configure Cut-off Rules:**
   - **Oral Presentation Cut-off (Score $\ge$):** Set to `7.5`.
   - **Poster Presentation Cut-off (Score $\ge$):** Set to `5.5`.
   - **Below Poster Cut-off Action:** Select `Set as Reject` (or `Set as Waitlist`).
   - **Min Completed Reviews:** Set to `1`.
   - **Skip Disputed Abstracts:** Ensure checkbox is checked `ON`.
   - **Disagreement Threshold Gap:** `2.0`.
   - Click **"Save Rules"**.
3. **Preview Cut-offs:**
   - Click **"Preview"** (with scope set to *All Tracks*).
   - **Inspect Preview Summary:**
     - Cards show: *Oral Assigned*, *Poster Assigned*, *Skipped (Reviews/Dispute)*, *Evaluated Total*.
     - Table lists every abstract with its current score and proposed provisional decision.
     - Abstracts flagged as disputed or having fewer than the minimum reviews show `Skipped` with the exact reason.
4. **Apply Provisional Decisions:**
   - Click **"Apply Cut-offs"**.
   - Confirmation dialog opens: *"This will update X abstracts with provisional decisions..."*.
   - Click **"Apply Provisional Decisions"**.
5. **Verify:**
   - Success toast confirms provisional decisions applied.
   - Switch back to the **Decision Board** tab: all eligible abstracts now display their provisional decision tagged with `"via Cut-off"`. The admin can still manually override any of them.

---

### Test Case 4.5: Customize Decision Email Templates (DEC-05)
1. Click the **Email Templates** tab (`#templates`).
2. Inspect the left sidebar listing the 6 system decision templates:
   - `Accept Oral` (`decision.accept_oral`)
   - `Accept Poster` (`decision.accept_poster`)
   - `Reject` (`decision.reject`)
   - `Revisions Requested` (`decision.revisions_requested`)
   - `Waitlist` (`decision.waitlist`)
   - `Waitlist Offer` (`decision.waitlist_offer`)
3. Click **"Accept Oral"**:
   - Notice the available merge variables listed: `{author_name}`, `{abstract_title}`, `{ref_no}`, `{presentation_type}`, `{event_name}`, `{registration_url}`, `{deadline}`, `{reviewer_comments}`.
   - Edit the **Subject:** `Annual Sessions 2026: Abstract Accepted for Oral Presentation — {ref_no}`.
   - Edit the **Body:** Add a line: `Please prepare a 10-minute slide deck with 2 minutes for Q&A.`
   - Click **"Save Template"**.
4. **Verify:** Success toast confirms save. A small `Custom` badge appears next to the template in the list.

---

### Test Case 4.6: Staged Release of Decisions (DEC-04, DEC-06, DEC-07)
1. Click the **Release** tab (`#release`).
2. **Configure Release Parameters:**
   - **Release Scope:** Choose `Entire Event (All Tracks)` or select a single category (e.g. `Trauma & Emergency Orthopaedics`) to test staged category-by-category release (DEC-04).
   - Banner displays: e.g. *"X Abstracts Ready for Release"*.
   - **Include Anonymized Reviewer Comments (DEC-06):** Check `ON`.
   - **Revision Deadline (DEC-07):** If any abstracts have decision `Revisions Requested`, set a date (e.g., 14 days in the future).
   - **Queue and Send Emails (DEC-05):** Check `ON`.
3. Click **"Release Decisions (X)"**.
4. Confirmation dialog appears:
   - *"Are you sure you want to release X decisions? Once released, decisions become visible to authors in their portal, and notification emails will be queued."*
5. Click **"Confirm & Release"**.
6. **Verify:**
   - Success toast: *"Released X decisions (X emails queued)"*.
   - Pending Release counter drops to 0 for the released abstracts.
   - Abstract statuses transition according to the state machine:
     - `ACCEPT_ORAL` / `ACCEPT_POSTER` &rarr; `ACCEPTED`
     - `REJECT` &rarr; `REJECTED`
     - `REVISIONS_REQUESTED` &rarr; `REVISIONS_REQUESTED`
     - `WAITLIST` &rarr; `WAITLISTED`
   - In the database / server logs, records are written to `email_logs` with status `QUEUED`.

---

### Test Case 4.7: Author Portal View: Decisions & Anonymized Comments (DEC-06, DEC-08)
1. Switch to an Incognito window signed in as the author (`submitter@example.com`).
2. Visit **My Submissions** (`/demo-college/aas-2026/my-submissions`).
3. **Verify Accepted Abstract (DEC-08):**
   - The card shows the green **Accepted** status badge and:
     > *"Congratulations — accepted for oral presentation."*
   - Notice the prompt: *"Please confirm whether you will present at the symposium, then register."*
   - Two action buttons are visible: **"Confirm slot"** (green) and **"Decline slot"** (outline red).
4. **Verify Decision SidePanel & Reviewer Comments (DEC-06):**
   - Click **"View decision"**.
   - SidePanel displays the Decision Outcome and Presentation Type badge.
   - **Reviewer Comments Section:** Anonymized author comments from each reviewer are displayed in clean feedback cards:
     - `Reviewer 1`: *"Well-written paper with sound methodology..."*
     - `Reviewer 2`: *"Good work. Recommend oral presentation."*
   - Verify that **no confidential committee comments** or reviewer identities are visible.

---

### Test Case 4.8: Author Slot Confirmation & Decline Workflow (DEC-08)
1. **Scenario A — Author Confirms Slot:**
   - On an accepted abstract card, click **"Confirm slot"**.
   - **Verify:**
     - Toast: *"Presentation slot confirmed"*.
     - Card updates to: *"✓ Presentation slot confirmed. Please complete registration before the deadline."*
     - **"Register now"** CTA button appears.
2. **Scenario B — Author Declines Slot:**
   - On a second accepted abstract card, click **"Decline slot"**.
   - Confirmation modal appears: *"Decline Presentation Slot? This will withdraw your abstract and allow the slot to be offered to a waitlisted author."*
   - Enter Reason: `Unable to travel due to exam duties`.
   - Click **"Confirm Decline"**.
   - **Verify:**
     - The abstract status updates to **Withdrawn** with tag `Slot Declined`.
     - In the admin Decision Board, this abstract now appears in the **Declined Slots** filter.

---

### Test Case 4.9: Slot Reallocation to Waitlist (DEC-08)
1. Switch back to the **Admin Decisions Board** (`/org/demo-college/events/aas-2026/decisions`).
2. Click the **"Declined Slots"** filter button.
3. Locate the abstract that was declined in Test Case 4.8.
4. Click the **"Offer Slot"** button on that row.
5. The **Offer Declined Slot to Waitlist** modal opens:
   - Select a waitlisted abstract from the dropdown (shows ref number, title, and score).
   - Click **"Offer Slot"**.
6. **Verify:**
   - Success toast: *"Slot offered to waitlisted author"*.
   - The selected waitlisted abstract is automatically promoted from `WAITLISTED` to `ACCEPTED`.
   - A promotion notification email (`decision.waitlist_offer`) is queued for the author.
   - When that author checks their dashboard, their abstract is now `ACCEPTED` with slot confirmation buttons enabled.

---

### Test Case 4.10: Revisions Requested Flow & Resubmission (DEC-07)
1. As Admin, set an abstract's decision to **Revisions Requested** and release it with a revision deadline (e.g. 14 days ahead).
2. Sign in as that abstract's author (`submitter@example.com`).
3. Visit **My submissions**:
   - **Verify:** Yellow banner displays:
     > *"Revisions requested by the committee. Please submit your revised abstract before [Date]."*
   - The button on the card reads **"Edit revisions"**.
4. Click **"Edit revisions"**:
   - The wizard opens with all previously entered fields pre-populated.
   - Update the abstract text (e.g. in Methods or Results).
   - Click through to the final step and click **"Submit Abstract"**.
5. **Verify:**
   - Status updates back to **Submitted**.
   - A new version is saved in **History** (Version 2).
   - In the database, the existing review assignments are reset to `IN_PROGRESS` so the **same reviewers** can re-evaluate the revised manuscript.

---

### Test Case 4.11: Export Official Abstract Book in Word & PDF (DEC-10)
1. In the Admin Decisions portal, click the **Exports & Books** tab (`#exports`).
2. Locate the **Abstract Book (Word & PDF)** card:
   - Toggle **"Include both Confirmed and Accepted abstracts"** (or leave off for Confirmed only).
3. **Word Document Export (.docx):**
   - Click **"Download Word (.docx)"**.
   - An auto-named file (e.g. `aas-2026-abstract-book.docx`) downloads immediately.
   - Open in Microsoft Word / LibreOffice:
     - **Cover Page:** Event Name, Edition, "ABSTRACT BOOK", Venue, Date, and College Name.
     - **Table of Contents:** Category headings with reference numbers and titles.
     - **Abstract Entries:** Grouped by category; Ref number, Presentation type, Title (bold), Authors with **presenting author underlined**, superscript affiliations list, and structured body sections (Introduction, Objectives, Methods, Results, Conclusions).
4. **Print / PDF View (HTML):**
   - Click **"Print / Save as PDF"**.
   - A clean, print-optimized document opens in a new tab.
   - Click the top right **"Print / Save as PDF"** button (or press `Cmd+P` / `Ctrl+P`).
   - Verify page breaks between categories and clean, publication-ready typography.

---

### Test Case 4.12: Export Submissions & Decisions Spreadsheet (DEC-11)
1. On the **Exports & Books** tab, locate the **Submissions & Decisions Spreadsheet** card.
2. Click **"Download Excel (.xlsx)"**.
3. An Excel file (e.g. `aas-2026-submissions-and-scores.xlsx`) downloads immediately.
4. Open the workbook in Microsoft Excel / Apple Numbers:
   - **Header Row:** Formatted with dark teal background, white bold text, and frozen top row.
   - **Columns Verified:**
     1. Ref No
     2. Title
     3. Category
     4. Submission Type
     5. Preferred Type
     6. Submitter Name & Email
     7. Presenting Author
     8. All Authors (roster with `*` indicating presenter)
     9. Affiliations
     10. Completed Reviews Count
     11. Average Score (weighted)
     12. Standard Deviation (SD)
     13. Score Gap
     14. Disputed Flag (`YES` / `No`)
     15. Chair Recommendation
     16. Decision
     17. Assigned Presentation Type
     18. Decision Released (`YES` / `No`)
     19. Slot Response (`CONFIRMED` / `DECLINED` / `Pending`)
     20. Registration Status
     21. Overall Submission Status

---

## 6. Consolidated Verification Matrix (Modules 1–4)

| Req ID | Module | Feature Description | Test Scenario | Verified? |
|---|---|---|---|:---:|
| **EVT-01** | Module 1 | Event details & assets | Create event with banner, logo, edition, venue | [x] |
| **EVT-02** | Module 1 | Public event page | `<org>/<event>` landing page with call for abstracts | [x] |
| **EVT-03** | Module 1 | Key dates engine | Automatic `canSubmit` portal state in Asia/Colombo time | [x] |
| **EVT-04** | Module 1 | Tracks & categories | Create tracks and assign track chairs | [x] |
| **EVT-05** | Module 1 | Submission types | Configure types, custom word limits & form rules | [x] |
| **EVT-06** | Module 1 | Presentation types | Oral, Poster, Either configured for decisions | [x] |
| **EVT-07** | Module 1 | Eligibility rules | Author caps, member requirement, presenter registration | [x] |
| **EVT-08** | Module 1 | Member list import | CSV file import with SLMC & membership number | [x] |
| **EVT-09** | Module 1 | Clone event | Duplicate settings, forms, and reviewer pool | [x] |
| **EVT-10** | Module 1 | Deadline extension | Individual author extension past regular deadline | [x] |
| **EVT-11** | Module 1 | Event dashboard | Submissions by status, track chart, review progress | [x] |
| **SUB-01** | Module 2 | Form builder | Dynamic custom questions (text, dropdown, dates) | [x] |
| **SUB-02** | Module 2 | Structured abstract | IMRaD and custom sections configured per type | [x] |
| **SUB-03** | Module 2 | Live word counter | Real-time counting with hard limit blocking | [x] |
| **SUB-04** | Module 2 | Clean abstract body | Greek/medical symbols allowed; tables/images blocked | [x] |
| **SUB-05** | Module 2 | Authors roster | Drag reorder, designate presenting and corresponding | [x] |
| **SUB-06** | Module 2 | Numbered affiliations | Single entry linked to authors by superscript numbers | [x] |
| **SUB-07** | Module 2 | Keywords | Tag chips with configurable limit | [x] |
| **SUB-08** | Module 2 | Ethics (ERC) | ERC approval status, ref number, and PDF upload | [x] |
| **SUB-09** | Module 2 | Declarations | Mandatory checkboxes: consent, patient data, COI | [x] |
| **SUB-10** | Module 2 | Presentation & Track | Select preferred presentation format and category | [x] |
| **SUB-11** | Module 2 | Draft auto-saving | Automatic background save every 30 seconds | [x] |
| **SUB-12** | Module 2 | Unique Reference # | Format `PREFIX-NNNN` generated with confirmation email | [x] |
| **SUB-13** | Module 2 | Version history | Snapshot per edit; author withdraw before decision | [x] |
| **SUB-14** | Module 2 | Eligibility enforcement | Blocks 3rd submission exceeding author cap | [x] |
| **SUB-15** | Module 2 | Duplicate title scan | Fuzzy title similarity detection for authors and admins | [x] |
| **SUB-16** | Module 2 | Submitter dashboard | Central portal for abstract tracking, status, and CTAs | [x] |
| **SUB-17** | Module 2 | Co-author notifications | Automated notice sent to all listed co-authors | [x] |
| **REV-01** | Module 3 | Reviewer pool | Invite consultants by email, record expertise & max load | [x] |
| **REV-02** | Module 3 | Confidentiality agreement | Mandatory agreement accepted before accessing abstracts | [x] |
| **REV-03** | Module 3 | Blind review | Double-blind masking of authors, institutions & files | [x] |
| **REV-04** | Module 3 | Rubric builder | Weighted criteria with min/max scales and comment fields | [x] |
| **REV-05** | Module 3 | Recommendations | Accept oral, Accept poster, Reject, Revise options | [x] |
| **REV-06** | Module 3 | Assignment engine | Manual, bulk by track, and conflict-aware auto-assign | [x] |
| **REV-07** | Module 3 | COI declaration | Single-click conflict return to chair for reassignment | [x] |
| **REV-08** | Module 3 | Review screen | Responsive side-by-side layout (stacked at 375px mobile) | [x] |
| **REV-09** | Module 3 | Reviewer dashboard | Track assigned, in-progress, completed, and countdown | [x] |
| **REV-10** | Module 3 | Progress tracking | % completion per reviewer/track and reminder queuing | [x] |
| **REV-11** | Module 3 | Scores & Disagreements | Weighted average, SD, and automatic dispute flags | [x] |
| **REV-12** | Module 3 | Blind score isolation | Reviewers cannot view peer scores unless enabled | [x] |
| **REV-13** | Module 3 | 3rd Reviewer assign | Direct assignment of adjudicating reviewer to disputes | [x] |
| **REV-14** | Module 3 | Reviewer certificate | Export formal Certificate of Appreciation with counts | [x] |
| **DEC-01** | Module 4 | Decision board | Ranked board by score, filters by track, score & disputes | [x] |
| **DEC-02** | Module 4 | Set decisions | Record decisions individually or in bulk with notes | [x] |
| **DEC-03** | Module 4 | Cut-offs engine | Preview and apply provisional decisions from thresholds | [x] |
| **DEC-04** | Module 4 | Staged release | Decisions hidden until released per track or whole event | [x] |
| **DEC-05** | Module 4 | Decision email templates | Editable templates with merge tags for all outcomes | [x] |
| **DEC-06** | Module 4 | Anonymized comments | Release peer-review feedback to authors without names | [x] |
| **DEC-07** | Module 4 | Revisions workflow | Reopen submission for revisions; routes to same reviewers | [x] |
| **DEC-08** | Module 4 | Slot confirm & decline | Author confirms/declines slot; declined slots reallocated | [x] |
| **DEC-09** | Module 4 | Auto-confirm & flagging | Confirm upon payment; flag overdue unregistered abstracts | [x] |
| **DEC-10** | Module 4 | Abstract book export | Generate Word (.docx) & HTML/PDF book with cover & TOC | [x] |
| **DEC-11** | Module 4 | Excel data export | Export all submissions, scores, SD, and decision statuses | [x] |
