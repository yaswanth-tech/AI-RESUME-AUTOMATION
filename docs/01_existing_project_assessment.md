# ASCEND Existing Project Assessment

**Phase:** 1 (read-only assessment)  
**Assessment date:** 2026-11-18  
**Scope:** Existing ASCEND implementation under `ASCEND-main/`; no application source was changed.

## Summary

This is an existing Express/Prisma/plain HTML application with real implementations for authentication, resume analysis, editable candidate records, JD matching, improvements, PDF/DOCX generation, reports, and the career dashboard. It also contains technical tests, communications tests, mock interviews, roadmaps, and opportunities. The “known starting point” does not match this checkout: the server port is configurable, auth and resume models exist, upload limit is 5 MB, and a `gemini-2.0-flash` AI provider service plus a recent migration are present. The legacy `geminiService` still hardcodes `gemini-1.5-flash`, and legacy routes import a missing prompts directory.

The server starts on port 3002 with the configured environment, with AI reported unavailable and deterministic fallback active. Prisma client generation succeeds. `npm install` reports dependencies up to date, with an engine warning that installed `nanoid@6.0.2` expects Node 22/24/26+ while this machine has Node 20.11.1. The test suite has four passing suites and one failure: auth tests call `jwt.sign` without a secret. The database migration/push and full feature E2E flows were not run because `.env` points at an unverified Supabase PostgreSQL target and the request requires this phase to be read-only. No resume PDF/DOCX test fixtures (including two-column/scanned) are present, so extraction accuracy cannot honestly be reported as a corpus percentage.

## Run and verification record

| Command/check | Result |
|---|---|
| `npm install --ignore-scripts --no-audit --no-fund` in `backend/` | Succeeded; up to date. Warning: `nanoid@6.0.2` engine does not include installed Node 20.11.1. |
| `npx prisma generate` | Succeeded; Prisma Client 5.22.0 generated from the current schema. |
| `npx prisma db push` | Not run. The configured database target is Supabase and was not verified as a disposable local database; running schema writes would violate the read-only assessment boundary. |
| `npm start` | Started successfully at `http://localhost:3002`; banner reports Gemini configuration with API key missing and deterministic fallback. Server was stopped after startup verification. |
| `npm test` | 4/5 suites pass. ATS parser, ATS evaluator, AI provider fallback, and PDF/DOCX export pass. Auth suite fails with `secretOrPrivateKey must have a value` from `tests/auth.test.js:25`. |
| Full end-to-end feature exercise | Not completed: needs a database schema deployed to a safe test database, valid local auth configuration, and candidate test files. |

No secrets or `.env` values were displayed. This assessment did not run `db push`, migrations, or API calls that create persistent user data.

## Architecture and data flow

### Frontend pages

- `frontend/index.html`: login and sign-up.
- `frontend/resume_upload.html`: resume upload, analysis, candidate editing, JD match, improvement acceptance/rejection, resume generation, and report actions.
- `frontend/dashboard.html`: career readiness scores and recent module data.
- `frontend/technical_test_setup.html`, `technical_test_session.html`, `technical_test_result.html`, `technical_test.html`, `technical_test.js`: technical assessments.
- `frontend/communication_test.html`, `communication_test.js`: communication assessment.
- `frontend/mock_interview_setup.html`, `mock_interview_session.html`: mock interview.
- `frontend/roadmap_setup.html`, `roadmap.html`: diagnosis and roadmap.
- `frontend/opportunities.html`: opportunity listing and actions.
- `frontend/js/userContext.js`, `frontend/js/tour.js`: shared identity/API context and onboarding tour.
- `frontend/Login page templates.html` and its companion assets appear unrelated to ASCEND's actual login flow and should be verified before inclusion in future work.

The static pages use direct `fetch` calls, with a mix of relative `/api` paths and hardcoded `http://localhost:3002` paths. This makes the configurable server port ineffective for some frontend calls and complicates deployment behind another origin.

### Backend routes

`backend/server.js` configures Express, permissive CORS, JSON/form parsing, global API rate limiting, request logging, route mounts, generated-file download aliases, upload directories, static frontend serving, and a configurable `PORT` (default 3002).

| Mount | Route module | Main responsibilities |
|---|---|---|
| `/api/auth` | `authRoutes.js` | Sign-up, login, current profile; bcrypt password hashing, JWT issuance, auth rate limiter. |
| `/api/ats` | `atsRoutes.js` | Upload/analyze, candidate update, JD match, apply improvement, generate resume/report, downloads, resume list/detail. |
| `/api/dashboard` | `dashboardRoutes.js` + `dashboardService.js` | Cross-module readiness data, recent resumes/matches/generated resumes, activity. |
| `/api/interview` | `interviewRoutes.js` | Mock interview sessions and answers. |
| `/api/test` | `testRoutes.js` | Technical test configuration, sessions, answers, results. |
| `/api/comm` | `commRoutes.js` | Communication test sessions/tasks/results. |
| `/api/opportunities` | `opportunityRoutes.js` | Opportunities, recommendations, sync, save/apply. |
| `/api/roadmaps` | `roadmapRoutes.js` | Roadmap templates, sync/init/progress. |
| `/api/diagnosis` | `diagnosisRoutes.js` | Readiness diagnosis and confirmation. |
| `/api/user` | `userRoutes.js` | Current user/tour/profile helpers. |

There are also unmounted legacy routes (`careerRoutes.js`, `technicalRoutes.js`, `communicationRoutes.js`) that import `geminiService` and `promptRegistry`; requiring promptRegistry fails because `backend/prompts/` is absent.

### Resume flow

`POST /api/ats/analyze-resume` applies a 5 MB multer limit and extension plus declared MIME checks, requires JWT auth and `targetRole`, stores the original-name-derived file in `backend/uploads/resumes`, extracts PDF text with `pdf-parse` or DOCX text with Mammoth, then calls `utils/atsParser.js`, `utils/atsEvaluator.js`, and `services/aiProviderService.js`. It writes `CandidateResume`, a legacy `AtsAnalysis`, and an activity log, then returns the parsed candidate, score breakdown, AI analysis, and rewrite suggestions. `POST /api/ats/update-candidate` persists candidate edits; `/match-jd` extracts JD data and calculates skill/experience/education/structure scores; `/apply-improvement` accepts/rejects a rewrite; `/generate-resume` exports three templates in PDF/DOCX; `/generate-report` creates PDF/CSV reports.

### Services, utilities, and models

- `services/aiProviderService.js`: Gemini 2.0 Flash selection via environment, resume analysis, JD extraction, rewrite generation, and deterministic fallbacks. Prompts are inline. API key only supports Gemini here.
- `services/geminiService.js`: legacy singleton hardcoding Gemini 1.5 Flash; writes stack traces to a debug log and logs raw provider failures.
- `services/promptRegistry.js`: requires five JS prompt modules from the missing `backend/prompts/` path.
- `services/responseValidator.js`: checks only required key presence; no nested types, bounds, schema library, retry, or repair.
- `services/resumeExportService.js`, `reportService.js`, `dashboardService.js`: exports and aggregation.
- `utils/atsParser.js`: line/header/regex parsing of 11 candidate fields; no OCR or multi-column layout reconstruction.
- `utils/atsEvaluator.js`: deterministic keyword and section scoring with breakdown and hiring-prediction disclaimer.
- `utils/candidateEdits.js`, `downloadToken.js`, `activityLogger.js`: edit/ownership helpers, signed download support, activity records.
- Prisma includes `User`, `AtsAnalysis`, `CandidateResume`, `JobDescription`, `JobMatch`, `GeneratedResume`, `CandidateReport`, plus existing interview, technical/communication tests, opportunities, roadmap, diagnosis, and activity models.

## Parser accuracy

**Measured exact extraction accuracy on a representative resume corpus: not measurable from this repository.** There are only three text fixtures (`sample_swe_resume.txt`, `sample_frontend_resume.txt`, `sample_incomplete_resume.txt`) and no PDF/DOCX fixtures, messy two-column/scanned examples, or independent field-level ground-truth annotations. The parser tests assert selected fields from one clean text fixture and missing values from one incomplete fixture; they do not calculate precision/recall or score all 11 fields across a corpus. Reporting a percentage would overstate evidence.

What the current tests establish: the clean sample has all 11 section headers recognized and the test confirms name/email/phone plus section presence; the structured candidate test checks skills/tools arrays; the incomplete sample confirms absent phone/summary/certifications/achievements remain empty. Work history structure, dates, institution/employer names, certifications, achievements and extracted field correctness are not fully asserted. The parser can misclassify early lines as names and depends on section heading text. PDF extraction quality, scanned PDF OCR, two-column ordering, DOCX quality, non-English content, and fake extensions remain unmeasured.

## AI, privacy, cost and security review

- **Active resume AI path:** `aiProviderService.js`, currently Gemini provider / `gemini-2.0-flash` defaults. AI is not active in this environment; service fallback ran in the test suite. `geminiService.js` is legacy and targets `gemini-1.5-flash`.
- **Prompts and response handling:** active service constructs prompts inline and asks for JSON, then `JSON.parse`s output. It checks top-level arrays on resume analysis and falls back on errors, but this is not schema validation. No invalid-output retry, explicit request timeout, cache, token/cost accounting, or per-user AI rate budget is evident. The legacy prompt registry is unusable because its referenced files are absent.
- **Grounding/anti-fabrication:** instructions say not to invent; `isGroundedInText` uses substring/token heuristics. In resume analysis a strength can pass if its `why` is longer than five characters, even if the item is ungrounded. Rewriting output is not robustly validated against source claims. Rule fallback suggestions mention example tools/certificates, which could be misread as candidate-specific recommendations.
- **Third-party data:** when enabled, `analyzeResume` sends candidate fields (including `rawText`, capped to 5,000 characters) plus target role to Gemini. The prompt includes PII that appears in raw text (name, email, phone, employers). JD parsing sends the JD text; rewriting sends candidate content and possibly JD context. Current code does not redact PII. Gemini service provider policies, retention, region, and pricing depend on account/settings and were not verified here.
- **Cost/rate risk:** request volume can trigger multiple model calls per resume (analysis plus improvements), and JD matching adds another. There are upload/API request limiters, but no token budget, AI-specific throttling, cache, timeout, or cost log. Large repeated requests can increase cost and latency.
- **Upload and storage:** extension and client-supplied MIME are checked, but magic bytes are not. Files use a timestamp and sanitized original name rather than a cryptographically random name. Upload storage is within backend tree and `.gitignore` excludes uploads, but path ownership and deletion/retention need review. No encryption-at-rest lifecycle is implemented in app code.
- **Authorization:** passwords are hashed and JWT auth exists. However, resume update/match/improvement/generation/report/detail lookups fetch by object ID without consistently constraining `userId` to `req.user.id`; `isOwner` is imported but not consistently applied. Optional/nullable ownership remains in new resume models and legacy AtsAnalysis. Several dashboard/user and other modules use optional auth or client-provided user IDs; role-based candidate/admin/recruiter access is absent.
- **HTTP and logs:** global `cors()` is permissive; Helmet is absent. Some endpoint errors return `error.message`, and request/error logs can expose URLs, details, or stack traces. The committed `backend/.env` is ignored by the root gitignore but is present in the checkout; repository tracking state could not be confirmed because no `.git` directory was present in the inspected project/root. Treat all credentials ever stored there as potentially exposed and rotate them (database credential, JWT secret, and any Gemini/OpenAI keys), then verify tracking/history in the true source repository. CSV datasets and logs exist under backend; generated resume exports also remain on disk.

## Existing feature exercise status

| Feature | Static/code and unit-test evidence | End-to-end status |
|---|---|---|
| Resume parse/evaluate | Parser and evaluator unit suites pass on text fixtures. | Upload-to-database not run; no PDF/DOCX sample set, auth secret test setup or safe DB target. |
| AI analysis/JD/rewrite | Fallback tests pass for structured result, JD requirements and rewrites. | Live provider not exercised (no configured key); provider output handling gaps remain. |
| Resume PDF/DOCX generation | Export suite generated each of three templates in both formats and passed. | Browser-to-API persistence/download not run. |
| Authentication | Signup/login implementation uses bcrypt/JWT; password hashing test passes. | Auth suite fails at JWT signing due missing test secret; API/database exercise not run. |
| Dashboard | Service aggregates current modules, resumes, matches, exports and activity. | Not run without safe DB. |
| Technical and communication tests | Routes, frontend pages and Prisma models present. | Not run end-to-end. |
| Mock interview | Routes and frontend session pages present. | Not run end-to-end. |
| Roadmap and opportunities | Routes, pages, and models present. | Not run end-to-end. |

## Errors and fixes needed before dependable local verification

1. Configure a disposable local PostgreSQL database and apply reviewed migrations; do not point development `db push` at production/Supabase by accident.
2. Set a non-placeholder JWT secret in an ignored local environment; update the auth test to inject a dedicated test-only secret and restore environment state.
3. Add test database setup/teardown and API/E2E tests; current tests are predominantly unit/component checks.
4. Resolve Node engine mismatch by pinning a compatible dependency or standardizing on Node 22+ after confirming deployment runtime compatibility.
5. Add representative PDF/DOCX test fixtures, including two-column and scanned PDFs (OCR capability is installed but not wired into resume upload).
6. Remove/rotate committed environment secrets and establish whether tracked in the upstream Git history; no `.git` metadata was available in the inspected tree to verify status/history.
7. Secure object-level ownership, upload validation/storage, error responses/logging, and CORS before processing real candidate documents.

## Files created

- `docs/01_existing_project_assessment.md`
- `docs/02_gap_analysis.md`

