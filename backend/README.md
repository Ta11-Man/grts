# GRTS Backend

FastAPI service and SQLite data layer for GRTS.

---

## File Overview

- `main.py` – REST API routes and application lifespan.
- `database.py` – SQLite connection, schema creation, safe migrations, CRUD logic, title/location normalizers, and analytics aggregation.
- `models.py` – Pydantic v2 validation models for request/response payloads.
- `updater.py` – Optional background script for checking IMAP email updates.
- `grts.db` – Local SQLite database file, intentionally ignored by Git.

---

## Database Schema (`grts.db`)

- **`companies`** – `id`, `name`, `domain`, `logo`, `website`, `created_at`
- **`jobs`** – `id`, `company_id`, `title`, `location`, `description`, `ats_job_id`, `ats_platform`, `job_type`, `workplace_type`, `salary_range`
- **`applications`** – `id`, `job_id`, `date_applied`, `status`, `url`, `notes`, `resume_version`, `priority`, `referral_source`, `archived`
- **`timeline`** – `id`, `application_id`, `event_type`, `event_date`, `notes`, `round_number`, `interviewer_name`, `interviewer_email`, `meeting_link`, `rating`, `compensation_offered`, `sort_order`
- **`application_responses`** – `id`, `application_id`, `question_text`, `answer_text`, `field_type`, `field_name` (strictly excludes sensitive/password fields)
- **`resumes`** – `id`, `name`, `content`, `version_tag`, `parent_id`, `commit_message`, `pdf_base64`, `pdf_file_name`
- **`user_profile`** – Key-value pairs for master autofill details.

---

## Key Logic

### Title Normalization (`normalize_job_title`)

Strips years (e.g. `2026`, `2027`), req numbers, and location tags to group variations like `Software Intern 2027` and `Software Engineering Intern - 2026` into `"Software Engineering Intern"` for accurate response rate metrics.

### Location Normalization (`normalize_and_split_locations`)

Strips Workday `"locations"` / `"posted locations"` prefixes and splits comma/slash-separated multi-location lists into individual locations.

---

## Main Endpoints

| Method   | Route                                 | Description                                                       |
| :------- | :------------------------------------ | :---------------------------------------------------------------- |
| `GET`    | `/applications`                       | List applications (supports `?status=`, `?sort_by=`, `?q=`)       |
| `POST`   | `/applications`                       | Create application manually                                       |
| `POST`   | `/apply`                              | Ingest application payload from extension content script          |
| `GET`    | `/applications/{id}`                  | Get application detail with full timeline & Q&A                   |
| `POST`   | `/applications/{id}/timeline`         | Log an interview / OA / rejection milestone                       |
| `PUT`    | `/applications/{id}/timeline/reorder` | Update display sort order of milestones                           |
| `DELETE` | `/timeline/{id}`                      | Delete a timeline milestone                                       |
| `GET`    | `/questions`                          | Query the Question Bank                                           |
| `DELETE` | `/questions/{id}`                     | Remove an entry from the Question Bank                            |
| `GET`    | `/resumes` / `POST /resumes`          | Manage tracked YAML/PDF resume versions                           |
| `GET`    | `/analytics/detailed`                 | Fetch time-series timeline, ATS split, title stats, and locations |
| `GET`    | `/profile` / `POST /profile`          | Get or update master autofill profile                             |
