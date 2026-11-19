# ASCEND Gap Analysis

**Phase:** 1  
**Assessment date:** 2026-11-18

Statuses mean: **Completed** = implemented and evidenced in current code/tests; **Partially completed** = some requested behavior exists, but material requirements remain; **Missing** = not present; **Bug** = present implementation fails or is unsafe; **Required enhancement** = proposed capability or quality step beyond the verified baseline.

| Module | Status | Current evidence and gaps |
|---|---|---|
| M1 Resume Upload | Partially completed | Authenticated PDF/DOCX upload, 5 MB limit, extraction, and persistence exist. Validation trusts extension and client MIME; no magic-byte check, random opaque filenames, content scanning, retention/deletion policy, or verified storage outside web root. Resume files are under backend/uploads. Candidate rows can be unowned because schema userId is optional. OCR is not used for scans. |
| M2 Parsing and correction | Partially completed | Rule parser maps 11 fields; frontend has editable candidate form; update endpoint persists JSON. Extraction is heuristic and tests do not measure field accuracy. No structured work/education/project entities, confidence, field provenance, or robust review workflow evidence. Update endpoint does not verify record ownership before read/update. |
| M3 AI resume analysis | Partially completed | AI-provider service supports resume analysis; fallback evaluator and feedback provide deterministic score/recommendations. Live provider is Gemini-only, prompts inline, output validation shallow, no invalid-output retry/timeout/cache/cost logging. Evidence grounding is weak and suggestion rationale may be generic; measured completeness/strengths/weaknesses/missing information not validated against source. |
| M4 Job description analysis | Partially completed | `/api/ats/match-jd` accepts text/file and service parses title, skills and experience/education/responsibility details; results persist. Required vs preferred qualifications/tools are not proven complete; file format checks reuse resume filter, do not validate JD magic bytes or size specifically; ownership is not checked on selected resume. |
| M5 Resume-JD matching | Partially completed | Matching/missing skills and score breakdown exist with guidance disclaimer. Scoring weights are implicit/hard-coded, experience/education based on text lengths, and required criteria coverage is shallow. Must show explicit normalized criteria/weights and evidence; ownership mismatch can disclose data. |
| M6 AI resume improvement | Partially completed | Summary/bullet rewrites and accept/reject UI/API exist; rule fallback exists. Candidate must be able to review. Anti-fabrication checks are insufficient: outputs are not semantically schema/claim validated against parsed source, and accept endpoint accepts client-supplied text without verifying it matches a generated suggestion or source. Ownership is not checked. |
| M7 Resume generation | Partially completed | Three templates and PDF/DOCX exports are implemented and export tests pass. Persisted generated records can be ownerless; generation by resume ID does not enforce owner; download routes use filename/path checks but are not authenticated/owner scoped. |
| M8 Candidate dashboard | Partially completed | Dashboard service aggregates profile-like status, resume scores, matches, generated files, activity, technical tests, communications, interview, roadmaps and opportunities. Some queries fall back to all users when userId is absent; dashboard route uses optional auth. Candidate resume detail payload may include raw text and PII. No fully verified protected, per-user end-to-end dashboard. |
| M9 Reports | Partially completed | Analysis PDF and skill-match CSV generation exist. Report model is not consistently written by route; report downloads are not owner-scoped. No full candidate profile report verified. |

## Cross-cutting requirements

| Area | Status | Gap / action for Phase 3+ |
|---|---|---|
| Preserve existing modules | Completed (baseline) | Keep technical/communication tests, mock interview, roadmap, opportunities, and dashboard routes/pages/models while integrating resume work. Require regression tests for shared changes. |
| Auth and roles | Partially completed | Bcrypt and JWT implemented; role field and admin/recruiter authorization are absent. Make all resume-related ownership relations mandatory and apply ownership filters consistently. Remove user ID trust from request bodies/query strings on protected paths. |
| AI provider abstraction | Partially completed | `aiProviderService` centralizes resume AI but is Gemini-specific; legacy Gemini singleton remains. Add a provider adapter boundary, env-selected provider/model, and eliminate or migrate the legacy calls without breaking unrelated modules. |
| Versioned prompts | Missing | `promptRegistry` references absent `backend/prompts/*.js`; active prompts are inline. Add versioned prompt files and usage metadata. |
| Structured output/schema validation | Bug | JSON parsing and shallow array/key checks only; `responseValidator` does no nested type validation. Add schema validation, bounded retry once, and safe deterministic fallback. |
| Timeouts, throttling, caching, cost | Missing | No AI request timeout, resume-hash cache, token/cost accounting or AI-specific quotas. Add bounded timeouts, cache invalidation/versioning, and PII-free metrics. |
| Privacy minimization | Missing | Raw text including contact details is sent to provider. Redact name/email/phone/address and send only required normalized fields/sections; document provider data handling and user notice. |
| Input and HTTP hardening | Partially completed | Some route validation and rate limits exist. Add schemas for every endpoint, Helmet, CORS allow-list, generic client errors, structured logs without resume data, and upload magic-byte checks. |
| Secrets and repository hygiene | Bug | `backend/.env` exists in checkout; root `.gitignore` excludes `.env`, uploads and logs, but tracked status/history is unverified. Verify real Git origin/history, untrack secrets/files if needed, rotate database/JWT/provider keys, keep `.env.example` placeholders. |
| Database constraints and deduplication | Partially completed | New Resume/JD/Match/GeneratedResume/Report models exist but ownership is nullable on most; no resume file hash/dedupe unique key or critical indexes. Migration exists but application status is unknown. Add hash, uniqueness, relation/index strategy and safe migrations. |
| Frontend deployment readiness | Required enhancement | Pages are plain HTML/JS as desired, but calls hardcode localhost and errors/loading/empty/responsive states need review across the full user flow. Retain shared `userContext`, tour, assets and visual language. |
| Verification | Bug | Unit suite has auth failure due missing JWT test secret and lacks API/DB/E2E and requested document fixtures. Establish local test DB, fixture corpus with field-level labels, E2E and anti-fabrication checks. |

## Security finding priority

1. **Critical before real candidate data:** owner-scoped queries and required ownership; current JWT does not prevent cross-user access by guessed/known resume ID.
2. **High:** confirm `.env` tracking/history and rotate database/JWT/API keys; use secret scanning and ensure files/uploads/logs are excluded from repository history.
3. **High:** validate PDF/DOCX magic bytes, randomize stored names, isolate storage, and make downloads owner-authorized.
4. **High:** minimize PII in AI input and strengthen source-grounding validation before output reaches review/export.
5. **Medium:** add Helmet, restrictive CORS, endpoint schemas, error redaction, and structured privacy-safe logs.

