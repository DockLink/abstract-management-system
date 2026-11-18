# Abstract Management System — User & Manual Testing Manual
## Modules 1 & 2: Event Setup and Submission Portal

This manual provides complete step-by-step instructions for testing and operating **Module 1 (Event Setup)** and **Module 2 (Submission Portal)**, in accordance with the system specification (`Abstract Management System — Requirements v1.md`).

---

## 1. Quick Start & Prerequisites

### 1.1 Start Development Server
Open your terminal in the project directory:
```bash
# 1. Ensure dependencies are installed and database is migrated
npm install
npm run prisma:generate

# 2. Seed default admin and organisation (if not already seeded)
npm run prisma:seed

# 3. Start Next.js development server
npm run dev
```
The application will be running at **`http://localhost:3000`**.

### 1.2 Seed Credentials & URLs
| Role | Email | Password | Primary Portal URL |
|---|---|---|---|
| **Platform / Org Admin** | `admin@example.com` (or value in `.env`) | `change-me-now` | `http://localhost:3000/login` |
| **Submitter / Author** | `submitter@example.com` | `change-me-now` | `http://localhost:3000/demo-college/aas-2026/my-submissions` |
| **Public Event Page** | Anonymous / All users | N/A | `http://localhost:3000/demo-college/aas-2026` |
| **API Swagger UI** | Public (or admin token) | N/A | `http://localhost:3000/swagger-ui` |

---

## 2. Module 1: Event Setup — Manual Test Guide

### Test Case 1.1: Create a New Event (EVT-01, EVT-02)
1. **Navigate to:** `http://localhost:3000/login`.
2. Sign in with the **Admin credentials** (`admin@example.com` / `change-me-now`).
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
   - *Test Close Date:* Temporarily change "Submission Close" to a past date. Save, then refresh the public page. The button should switch to disabled with **"Submissions closed"**. Revert the date back to open.

---

### Test Case 1.3: Tracks & Categories (EVT-04)
1. Click **Categories** in the admin sidebar.
2. Add the following categories:
   - `Trauma & Emergency Orthopaedics`
   - `Spine & Spinal Deformity`
   - `Paediatric Orthopaedics`
3. Optional: Assign a Track Chair user if users exist.
4. Drag or use sort order to reorder the categories.
5. **Verify:** Categories appear in the table and will be available in the submission wizard dropdown.

---

### Test Case 1.4: Submission Types & Default IMRaD Sections (EVT-05)
1. Click **Submission Types** in the admin sidebar.
2. Notice the default seeded submission types (e.g. *Original Research*, *Clinical Audit*, *Case Report*).
3. Click **Edit** on *Original Research*:
   - Change **Word limit** to `300`.
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
2. Prepare a test CSV file `members.csv` with the following content:
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
   - **Label:** `Clinical Trial Registry Number`
   - **Type:** `Short Text`
   - **Help Text:** `Enter SLCTR or WHO trial ID if applicable`
   - **Required:** Leave `OFF` (Optional).
   - Click **"Create Field"**.
   - Add another field:
     - **Label:** `Study Setting`
     - **Type:** `Dropdown Select`
     - **Options (comma-separated):** `Tertiary Referral Hospital, Base Hospital, Multi-centre, Community Setting`
     - **Required:** Toggle `ON`.
   - Click **"Create Field"**.
5. Close the dialog.
6. **Verify:** The form builder configuration is saved and will immediately render dynamically in the author submission form.

---

### Test Case 2.2: Author Sign In & Start Submission (SUB-10, SUB-11)
1. Open an Incognito/Private browser window (or sign in as an author account).
2. Visit the public event page: `http://localhost:3000/demo-college/aas-2026`.
3. Click **"Submit abstract"**.
4. If not signed in, you will be directed to `/login` with an automatic return redirect. Sign in.
5. You are brought to the **Submission Form Wizard** (`/demo-college/aas-2026/submit`).

---

### Test Case 2.3: Step 1 — Details & Duplicate Title Detection (SUB-10, SUB-15)
1. **Submission Type:** Select `Original Research`.
2. **Category / Track:** Select `Trauma & Emergency Orthopaedics`.
3. **Preferred Presentation:** Choose `Oral presentation preferred`.
4. **Title:** Enter: `Management of open tibial fractures: a prospective 5-year multicentre study in Sri Lanka`.
5. **Test Duplicate Warning (SUB-15):**
   - If an existing submission with a very similar title exists, notice the yellow warning banner immediately appear:
     > *"Similar abstract detected: 'Management of open tibial fractures in Sri Lanka' (92% match). Please verify you are not submitting a duplicate."*
6. Click **"Continue to Authors"**.

---

### Test Case 2.4: Step 2 — Authors & Numbered Affiliations (SUB-05, SUB-06)
1. **Add Affiliations:**
   - Under **Affiliations**, click **"Add Institution"**.
   - Enter: `Department of Orthopaedics, National Hospital of Sri Lanka`. (This is Affiliation #1)
   - Click **"Add Institution"** again.
   - Enter: `Faculty of Medicine, University of Colombo`. (This is Affiliation #2)
2. **Add Authors:**
   - Click **"Add Author"**.
   - **Surname:** `Perera`
   - **Initials:** `S.K.`
   - **Email:** `sunil.perera@example.com`
   - **Designation:** `Senior Registrar`
   - **SLMC Number:** `24500`
   - **Affiliated Institutions:** Check `[1]` and `[2]`.
   - Toggle **Presenting Author** -> `ON`.
   - Toggle **Corresponding Author** -> `ON`.
   - Click **"Save Author"**.
3. **Add Second Author (Co-author):**
   - Click **"Add Author"**.
   - **Surname:** `Silva`
   - **Initials:** `A.`
   - **Email:** `anoma.silva@example.com`
   - **Affiliated Institutions:** Check `[1]`.
   - Leave Presenting Author `OFF`.
   - Click **"Save Author"**.
4. **Test Reordering (SUB-05):**
   - Click the **Move Down** arrow on Dr. Perera, then **Move Up**. Verify the order updates smoothly.
5. Click **"Continue to Abstract Body"**.

---

### Test Case 2.5: Step 3 — Structured Abstract & Live Word Counter (SUB-02, SUB-03, SUB-04, SUB-07, SUB-01)
1. **Structured Sections:**
   - You will see each section: *Introduction*, *Objectives*, *Methods*, *Results*, *Conclusions*, and your custom section *Funding & Acknowledgements*.
2. **Rich Text Formatting & Symbols (SUB-04):**
   - Click the **Symbols** button on the editor toolbar.
   - Insert symbols: $\alpha$, $\beta$, $\pm$, $\le$, $\ge$, $\mu\text{g}$.
   - Apply **Bold** and **Italic** formatting.
3. **Test Table/Image Blocking (SUB-04):**
   - Try copying an image or HTML table from a webpage and pasting it into the editor.
   - **Verify:** A toast notification appears:
     > *"Tables and images are blocked in the abstract body (table/img). Cleaned text will be used."*
4. **Test Live Word Counter & Hard Limit (SUB-03):**
   - Observe the top right badge: `Word Count: X / 300`.
   - Type or paste text until it exceeds 300 words.
   - **Verify:** The badge turns red and displays `(Exceeded)`.
   - Attempting to proceed will display: *"Abstract exceeds word limit of 300 words"*.
   - Reduce text to under 300 words (e.g. 180 words).
5. **Keywords (SUB-07):**
   - Type `Tibial fracture` -> press Enter.
   - Type `Fixation` -> press Enter.
   - Type `Outcomes` -> press Enter.
   - Verify 3 keyword chips are displayed.
6. **Custom Form Fields (SUB-01):**
   - Select **Study Setting:** Choose `Tertiary Referral Hospital`.
   - Enter **Clinical Trial Registry Number:** `SLCTR/2024/012`.
7. Click **"Continue to Ethics & Declarations"**.

---

### Test Case 2.6: Step 4 — Ethics (ERC) & Mandatory Declarations (SUB-08, SUB-09)
1. **ERC Status (SUB-08):**
   - Select **"ERC Approved"**.
   - Enter **Approving Institution:** `ERC, National Hospital of Sri Lanka`.
   - Enter **ERC Reference Number:** `ERC-2024-889`.
   - Click **"Browse file"** under PDF upload. Select a valid `.pdf` document.
   - **Verify:** Upload completes and displays `ERC Certificate uploaded`.
2. **Mandatory Declarations (SUB-09):**
   - Toggle **Author Consent** -> `ON`.
   - Toggle **Patient Confidentiality** -> `ON`.
   - Leave **No Conflicts of Interest** as `ON`.
   - Leave **Prior Presentation / Publication** as `OFF`.
3. Click **"Review Abstract"**.

---

### Test Case 2.7: Step 5 — Verification, Auto-Save, & Submission (SUB-11, SUB-12, SUB-14, SUB-17)
1. **Auto-save Check (SUB-11):**
   - Notice the header: `Draft saved [time]`. Every 30 seconds or upon clicking "Save Draft", state is securely synchronized to the database.
2. **Preview Verification:**
   - Inspect the formatted abstract preview:
     - Title displayed in bold.
     - Authors: `Perera S.K.1,2, Silva A.1` (Presenting author underlined).
     - Numbered affiliation list.
     - Formatted sections with Greek symbols preserved.
     - Keywords listed.
   - Verification checklist shows all green checkmarks.
3. Click **"Submit Abstract"**.
4. **Verify Submission Success (SUB-12):**
   - Celebration screen displays with your unique **Reference Number** (e.g. `AAS26-0001`).
   - Terminal logs will show `[Notification:SUB-12]` confirmation dispatched to submitter and `[Notification:SUB-17]` dispatched to co-author Dr. Silva.

---

### Test Case 2.8: Submitter Dashboard, Withdraw & Version History (SUB-13, SUB-16)
1. Click **"Go to Submitter Dashboard"** (or navigate to `/demo-college/aas-2026/my-submissions`).
2. **Verify Submission Card:**
   - Shows Reference Number (e.g. `AAS26-0001`).
   - Title, category, presenter name, word count.
   - Blue **"Submitted"** status badge.
3. **Version History (SUB-13):**
   - Click **"History"** button.
   - A dialog opens displaying **Version 1** snapshot timestamp. Close dialog.
4. **Withdraw Action (SUB-13):**
   - Click **"Withdraw"**.
   - A confirmation dialog appears: *"Are you sure you want to withdraw...?"*.
   - Click **"Confirm Withdrawal"**.
   - **Verify:** Status badge switches to **"Withdrawn"**. The abstract is now closed from review consideration.

---

### Test Case 2.9: Admin Submissions Management & Duplicate Title Scan (EVT-11, SUB-13, SUB-15)
1. Switch back to your **Admin window**.
2. Click **Submissions** in the admin sidebar (`/org/demo-college/events/aas-2026/submissions`).
3. **Verify Table:**
   - The submission you created appears in the table with its ref number, presenter, category, and status.
   - Test filters: Filter by category, submission type, or search text.
4. **Inspect Submission:**
   - Click **"Inspect"** on the submission.
   - Full abstract body, authors, affiliations, and declarations are displayed.
   - Click **"Download ERC Certificate (PDF)"** to verify the secure signed download URL.
   - Change Status dropdown from `Submitted` to `Accepted`.
5. **Check Submitter View for Accepted Abstract (SUB-16):**
   - Switch to the author's window (`/my-submissions`) and refresh.
   - **Verify:** The submission now displays a green **"Accepted"** badge.
   - Prominent green banner appears: **"Abstract accepted for presentation! The presenting author must complete registration to confirm their slot."**
   - **"Register now"** button is present.
6. **Admin Duplicate Scan (SUB-15):**
   - On the Admin Submissions page, click **"Check Duplicate Titles"**.
   - A dialog will perform a pairwise scan across all event abstracts using bigram Sorensen-Dice and word Jaccard algorithms.
   - If two abstracts have near-identical titles (e.g., test by submitting two abstracts with titles differing by only 1 word), they will appear highlighted with their exact similarity percentage (e.g. `94% match`).

---

### Test Case 2.10: Author Cap Eligibility Enforcement (SUB-14)
1. As an author, attempt to submit a 3rd abstract designating the same presenting author (`sunil.perera@example.com`).
2. Note that the event eligibility was set to a maximum of `2` abstracts per author.
3. On the final step, click **Submit Abstract**.
4. **Verify:** The API rejects submission with:
   > *"The presenting author has reached the maximum of 2 abstract(s) per event."*

---

## 4. Troubleshooting & Verification Checklist

| Requirement | Test Scenario | Verified? |
|---|---|---|
| **EVT-01** | Create event with banner, logo, edition, venue | [x] |
| **EVT-03** | Key dates drive automatic `canSubmit` portal state in Asia/Colombo time | [x] |
| **EVT-07/SUB-14** | Blocks 3rd submission from same presenting author | [x] |
| **EVT-08** | Member list CSV upload and match verification | [x] |
| **SUB-01** | Form builder adds text, dropdown, and custom questions per type | [x] |
| **SUB-02** | Structured abstract sections (IMRaD or custom) rendered | [x] |
| **SUB-03** | Real-time word counter with hard limit enforcement | [x] |
| **SUB-04** | Greek/medical symbols supported; tables and images blocked | [x] |
| **SUB-05** | Authors list with drag/order, presenting and corresponding flags | [x] |
| **SUB-06** | Institutions linked by superscript numbers to authors | [x] |
| **SUB-08** | ERC status, reference number, and PDF certificate upload | [x] |
| **SUB-09** | Author consent, confidentiality, and COI required declarations | [x] |
| **SUB-11** | Auto-saves draft every 30 seconds | [x] |
| **SUB-12** | Unique reference number generated on submit (`SLOA26-NNNN`) | [x] |
| **SUB-13** | Change history tracked as versions; withdraw allowed before decision | [x] |
| **SUB-15** | Near-identical title duplicate warnings for submitter & admin | [x] |
| **SUB-16** | Submitter dashboard shows status, comments, and "Register now" CTA | [x] |
| **SUB-17** | Co-authors receive notification email that they were listed | [x] |

