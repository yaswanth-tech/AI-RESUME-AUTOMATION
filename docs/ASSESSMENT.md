# ASCEND Resume Flow Assessment

Assessment date: 2026-11-18

## Scope and runtime

The project is an existing Node.js/Express application with a plain HTML/JavaScript frontend, Prisma models and a PostgreSQL datasource. The resume flow already has substantial implementation across its parser, evaluator, API routes, AI provider, export/report services and dashboard. This assessment records the current state; it does not replace those components.

The backend dependencies are installed. Running `npm start` from `backend/` exits before the server listens: `backend/routes/atsRoutes.js` imports `./downloadRoutes`, but that module is absent. This blocks all backend routes, including resume upload and dashboard API calls.

Git status could not be read. The provided project directories contain no `.git` metadata, and Git reports `fatal: cannot change to 'C:/Users/rajana yaswanth'`. Therefore no claim is made about tracked/untracked changes or commit state. `backend/.env` exists; its contents were not printed. The supplied project notes identify it as committed with leaked credentials. Treat all credentials in it as exposed and rotate them.

## Resume flow status

| Area | Status | Current implementation and evidence |
|---|---|---|
| `atsRoutes` | Partial / buggy | Has routes for upload and analysis, candidate edits, job-description matching, improvement acceptance/rejection, resume generation, reports, downloads, resume listing and resume details. Upload accepts PDF/DOCX with a 5 MB limit and stores files under `backend/uploads/resumes`. Routes require JWT auth in most cases. Startup is blocked by the missing `downloadRoutes` module. Several reads/updates fetch by record ID without checking that `userId` matches the authenticated user. Matching/generation also accept body `userId` fallbacks, which can associate records with caller-supplied identities. Some endpoints persist uploaded files or records before later failures. |
| `atsParser` | Partial | Rule-based parsing identifies name, email, phone and the sections summary, skills, tools, education, experience, projects, certifications and achievements. `parseStructuredCandidate` provides editable-looking structured data and skills/tools lists. Heuristic section parsing can misclassify the first lines as a name, misses content without recognized headings, and does not reliably distinguish section headings from text beginning with a keyword. No explicit parser confidence or correction provenance is present. |
| `atsEvaluator` | Partial | Provides a deterministic role-keyword and resume-structure score, feedback rows, score breakdown and a guidance notice that the score is not a hiring prediction. It uses substring matching and generic fallback criteria, so matches can be imprecise; score components and explanatory feedback are heuristic guidance rather than validated job-specific evidence. |
| `resume_upload.html` | Partial | Existing workbench supports selecting a role, uploading a resume, reviewing parsed sections, matching a JD, viewing analysis, applying improvements, exporting resumes and generating reports. It calls the backend at a hard-coded localhost URL and uses the existing user-context auth helper. Client-side checks are not a substitute for server validation. Current API failures prevent the flow from running end-to-end. |
| `geminiService` | Buggy / legacy | Still directly selects the retired `gemini-1.5-flash` model and reads `GEMINI_API_KEY`; errors are written with stack traces to a local log. The newer `aiProviderService` separately supports `AI_PROVIDER`/`AI_MODEL`, schema-shaped prompts and fallback behavior, but its validation and grounding checks are incomplete (for example, some output fields are accepted without strict per-item schema checks, and a non-grounded strength can be retained based on its explanation). The older service remains a risky competing AI path. |
| `dashboard` | Partial / buggy | `dashboard.html` already displays resume, match and generated-resume panels. `dashboardService` queries these records and maps them into dashboard data. `dashboardRoutes` uses `optionalAuth` and falls back to a hard-coded user ID; this is not a secure per-user boundary. Download aliases in `server.js` serve files by basename without authentication/ownership checks. Dashboard data is therefore present in code, but not safely isolated and inaccessible while startup is blocked. |

## Security and configuration findings

- `backend/.env` exists and, per the supplied project context, is committed with leaked credentials. Do not reproduce its values. Revoke/rotate the exposed database, JWT and AI credentials; remove the file from version control/history as an operational follow-up.
- Authentication pieces are present (`authRoutes`, bcrypt password hashing, JWT middleware and rate limiters), so authentication is not wholly absent. However, the app does not enforce it consistently: dashboard stats permit optional/anonymous access, hard-coded identity fallbacks exist, and ATS record operations do not consistently enforce ownership. In its current state this is not real, reliable per-user authentication/access control.
- `geminiService.js` uses `gemini-1.5-flash`, which is retired. `aiProviderService.js` defaults to `gemini-2.0-flash`; configuration is split between the two services.
- `.gitignore` excludes environment files and upload/log directories, but that does not remove an already tracked `backend/.env` or revoke exposed credentials.

## Already implemented (avoid duplicating in Step 2)

There are existing beginnings of all nine requested feature groups: upload validation and persistence; structured parsing and update endpoint; AI analysis with a fallback; JD parsing and match records; improvement suggestions and accept/reject endpoint; PDF/DOCX generation with named templates; dashboard resume/match/download panels; and PDF/CSV report generation. These are partial and/or have the defects listed above. Step 2 should target only verified gaps and ownership/security defects, keeping this stack and existing UI style.

## Not verified

The server could not start, so browser behavior, database connectivity, migrations, model availability, API behavior and download flows could not be exercised. No test suite was run during this assessment.
