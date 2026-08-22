# GRTS Extension & Dashboard

Manifest V3 browser extension and single-page dashboard for automated job tracking, portal parsing, and autofill.

---

## File Overview

- `manifest.json` – MV3 manifest for Firefox and Chromium browsers.
- `background.js` – Background service worker. Proxies local API requests (`127.0.0.1:8000`) and caches profile data in `chrome.storage.local` to avoid browser Private Network Access prompts.
- `content.js` – Detects and parses ATS portals (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Generic JSON-LD), extracts company info/links, and captures final submissions.
- `autofill.js` – Form filling engine. Injects values with React-compatible synthetic events, parses YAML resume fields, attaches active PDF resumes via `DataTransfer`, and harvests custom Q&A.
- `dashboard.html` / `dashboard.js` – Full-featured single-page app (Table, Kanban, SVG Range Timeline, Location Geo Map, Resume Manager, Q&A Bank).
- `popup.html` / `popup.js` – Toolbar popup for quick status checks and manual triggers.

---

## How It Works

### 1. ATS Detection & Extraction (`content.js`)
When navigating to a job page, `content.js` checks URL patterns and DOM signatures:
- **Workday**: Extracts role, location (strips prefixes), requisition ID, and company URL from `a[data-automation-id="logoLink"]`.
- **Greenhouse / Lever / Ashby**: Parses standard job metadata and organization branding.
- **Generic Portals**: Falls back to `schema.org/JobPosting` JSON-LD and OpenGraph tags.

### 2. Form Autofill & PDF Attachment (`autofill.js`)
- Reads user profile from `chrome.storage.local` (populated by `background.js`).
- Automatically extracts `skills`, `education`, `experience`, and `gpa` from YAML resume text.
- If a file input (`input[type="file"]`) is found on the portal, converts the Base64 PDF into a `File` object and injects it via `DataTransfer`.
- Renders a floating quick-fill badge in the bottom-left corner.

### 3. Submission Capture & Security
- Listens for final submission buttons (`Submit`, `Review and Submit`, Workday submit button).
- Extracts non-standard question/answer pairs while **strictly blacklisting** password, secret, PIN, and SSN fields.
- Sends payload to `background.js`, which POSTs to `POST /apply` on the backend.

### 4. Automatic Step Progression ("Save and Continue")
- When a page fills with high confidence and no required fields are left blank, `autofill.js` automatically triggers the intermediate step progression button (`Save and Continue`, `Next`, `Continue`).
- **Safety Mechanism**: Final application submission buttons (`Submit`, `Submit Application`, `Finish`) are explicitly excluded to guarantee the user always has the final opportunity to review before applying.

### 5. Dashboard SPA (`dashboard.html` / `dashboard.js`)
- **Table View**: Quick filtering, search, and detail drawer with re-orderable milestones.
- **Kanban Board**: Single-row horizontal scrolling pipeline with drag-and-drop column transitions.
- **Analytics View**: Chronological SVG timeline range chart (Applied on top, Rejections on bottom, Active pipeline in middle) and interactive SVG Location Geo Map.
- **Resume Manager**: Track resume revisions with side-by-side diff viewer and PDF attachments.
- **Question Bank**: Searchable catalog of captured questions with one-click copy and delete actions.

---

## Known Issues & Notes

- **Workday Skills MultiSelect**: In certain Workday tenant deployments, the optional "Skills" combobox uses a deep synthetic focus trap that may not convert search terms into tag-pills automatically without manual key selection. Workday does not require skills for application submission when work experience and education are present.
- **Resume Single Attachment**: Guaranteed strictly 1 resume attachment per portal session across initial fill and "Re-run" triggers.
