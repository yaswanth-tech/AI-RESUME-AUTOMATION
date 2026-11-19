# ASCEND architecture

## Runtime

- Plain HTML/CSS/JavaScript pages in `frontend/` are served by Express.
- Express routes in `backend/routes/` use Prisma Client against PostgreSQL.
- `backend/server.js` loads environment configuration, Helmet, CORS allow-list, API rate limit, sanitized request logging, route mounts and static frontend serving. Port defaults to 3002 and is configurable.
- Auth uses bcrypt password hashes and JWT bearer tokens. Active resume routes require a candidate role and filter records by the authenticated user ID.

## Resume workflow

1. Browser sends an authenticated PDF/DOCX upload to `POST /api/ats/analyze-resume` (alias `POST /api/ats/resumes`). Upload is buffered in memory up to 5 MiB, checked for extension/signature, and DOCX package structure is validated.
2. `documentTextService` extracts embedded PDF text and uses local PDF.js rendering + Tesseract OCR when little text is embedded. Mammoth extracts DOCX text.
3. `atsParser` creates structured candidate fields; `atsEvaluator` computes deterministic completeness/role guidance. AI enhancement is optional and falls back to deterministic output.
4. Prisma stores the resume, owner, parsed version/evidence, analysis and pending suggestions in a transaction. Resume bytes are stored under an OS temp private directory (or `RESUME_STORAGE_DIR`), outside static files. The raw resume text is not stored in `CandidateResume.rawText`.
5. Candidate reviews/corrects fields via `POST /api/ats/update-candidate`; JD analysis/matching uses `POST /api/ats/match-jd`; accept/reject uses `POST /api/ats/apply-improvement`.
6. Candidate may export a PDF/DOCX and reports. Authenticated downloads enforce ownership. Dashboard data is scoped to the current account.

## Data and external services

PostgreSQL stores user accounts, resume records, parsed versions/evidence, analyses, JDs, matches, generated-resume metadata, reports, suggestions and existing career-module records. Resume and generated artifacts live in private filesystem directories, not the public static root. The optional OpenAI adapter sends redacted selected text only; see [AI integration](AI_INTEGRATION.md). OCR is local, apart from optional Tesseract language-data retrieval if no local trained data is configured.

## Existing modules

The existing career dashboard, roadmaps, opportunities, technical/communication tests and mock interviews are retained. Shared frontend user context now uses authenticated relative API requests. Resume ownership is mandatory for resume-intelligence records; unrelated legacy learning records retain their existing ownership model and should receive a separate security review before multi-tenant production use.
