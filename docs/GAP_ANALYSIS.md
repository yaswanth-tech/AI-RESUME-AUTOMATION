# ASCEND Resume Flow Gap Analysis

Assessment date: 2026-11-18

This gap analysis distinguishes existing partial work from items that are absent or unsafe. The app is Node/Express, Prisma/PostgreSQL and plain HTML/JavaScript; keep that architecture and UI style when implementing approved follow-up work.

## Blocking issue

`npm start` from `backend/` fails while loading `backend/routes/atsRoutes.js`: the required `backend/routes/downloadRoutes.js` module is missing. Consequently no resume or dashboard API flow can currently run. Fix this first after approval, preserving the intended signed-download behavior rather than adding a public bypass.

## Requested feature-by-feature status

| Step 2 item | Status | Gaps to close after approval |
|---|---|---|
| 1. Resume upload | Partial | Server checks extensions/MIME and caps at 5 MB; stores in a local uploads directory and records metadata. Verify actual file signatures, remove unsupported legacy `.doc` from the filter discrepancy, ensure private storage and cleanup behavior, and test candidate persistence. |
| 2. Parse/edit candidate fields | Partial | Parser returns all requested fields and the UI has a review/edit workflow with an update endpoint. Verify every field is editable and persisted. Improve extraction/section boundaries and ensure corrections remain grounded in the resume. |
| 3. AI analysis | Partial | New provider service returns strengths, weaknesses, missing info and suggestions with `why`, plus deterministic fallback. Enforce a real JSON schema and robust grounding checks on all AI claims; current checks can allow unsupported content. |
| 4. Job description | Partial | UI and endpoint accept entered/uploaded JDs and AI extraction covers required/preferred skills and other requirements. Confirm supported formats and validate schema/fallback output. Uploaded JD handling currently shares resume upload filter and is not tailored to text files. |
| 5. Matching | Partial | Persists matching/missing skill lists and an explainable score breakdown with a guidance notice. Ownership is unchecked, skill matching is substring-based, and score criteria do not consistently use JD experience/education requirements. |
| 6. Improvement | Partial | Summary and bullet rewrites are generated and the UI exposes accept/reject. Verify every generated rewrite maps to exact source material; accepting bullets currently appends them instead of replacing a selected original item. |
| 7. Resume generation | Partial | PDF and DOCX export services and three template names are present. Verify template selection, validated candidate content, safe downloads and per-user file access. |
| 8. Dashboard | Partial | Existing page and service include resumes, matches and generated downloads. Extend/verify analysis details and reports, remove hard-coded identity fallback, require auth and enforce user scoping on queries and downloads. |
| 9. Reports | Partial | Existing analysis PDF and skill-match CSV generation routes/services. Verify missing-skills reporting, authorization, generated file lifecycle and links in the dashboard. |

## Cross-cutting gaps

### Authentication and ownership

Password hashing, signup/login and JWT middleware already exist. The gap is consistent enforcement: dashboard routes use optional auth and a hard-coded fallback ID; record operations in ATS routes commonly look up by ID without an owner predicate; some routes allow client-provided `userId`; download routes are public aliases. Require a valid user and scope reads, updates, inserts, report generation and downloads to that user.

### Secrets and environment

`backend/.env` is present and the project context says it is committed with exposed credentials. The values were intentionally not read or logged. Rotate affected credentials, remove the tracked secret file/history as appropriate, retain only safe placeholders in `.env.example`, and verify ignore rules. The current ignore rules cannot untrack an already committed file.

### AI provider and retired model

`geminiService.js` hard-codes retired `gemini-1.5-flash`; `aiProviderService.js` already uses environment-configurable provider/model variables and a fallback. Consolidate the resume flow onto the configurable provider path after identifying any other consumers. Keep failures private and avoid logging resume content or API credentials. Validate complete output shapes and ground each claim against source text.

### Data and schema changes

Prisma already defines `CandidateResume`, `JobDescription`, `JobMatch`, `GeneratedResume` and `CandidateReport`, as well as relations to `User`. Inspect the existing migrations and actual database before adding models or migrations; do not duplicate these records. Enforce ownership in queries and consider making user relations required only through a reviewed migration strategy, since existing schema permits nullable owners.

### Operational verification

Before feature work can be verified, restore app startup by resolving the absent route module. Then exercise endpoints and UI against a configured local PostgreSQL database and valid environment variables. No tests were run for this assessment, and the database/migration state remains unverified.

## Recommended implementation order after “go”

1. Resolve startup blocker and validate private upload path, type, size and persistence.
2. Enforce authentication and per-user ownership before exposing/editing stored resume and match records.
3. Verify editable parsing, JD extraction, matching and grounded AI output with the existing parser/scorer as the base.
4. Complete improvements, generation, dashboard and report gaps without duplicating existing pages/services.
5. Add requested realistic tests and API/AI/user documentation, update README, and commit each working feature as requested.
