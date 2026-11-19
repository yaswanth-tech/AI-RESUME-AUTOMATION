# ASCEND Development Plan

**Phase:** 2 (planning only; no application code or schema changes)  
**Date:** 2026-11-18  
**Basis:** Phase 1 findings in `01_existing_project_assessment.md` and `02_gap_analysis.md`.

## Summary and recommendation

Implement the approved resume workflow incrementally in the existing Express/Prisma/PostgreSQL and plain HTML/JS application. Keep the rule parser/evaluator as deterministic fallback, keep existing career modules and shared frontend context, and secure ownership before exposing candidate data. No code has been changed in this phase.

**Recommended provider:** OpenAI API through the already-installed `openai` SDK, selected by `AI_PROVIDER` and `AI_MODEL`, behind one adapter interface. Configure an economical currently supported model by environment (initial candidate: `gpt-6-luna`, subject to a small quality/cost evaluation before enabling it). The official pricing page lists token-based billing and currently lists GPT-6 Luna among the low-cost models; rates are provider-controlled and must be checked at deployment. Strict JSON Schema output is supported, but application-level business validation remains necessary. OpenAI states API inputs are not used to train models by default, while abuse monitoring may retain content up to 30 days and endpoint/application-state retention varies; set non-storing request options where supported and verify account-level data controls before production. Therefore, redact unnecessary PII first and do not describe provider processing as zero-retention by default. Sources: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [API data controls](https://developers.openai.com/api/docs/guides/your-data), [API pricing](https://developers.openai.com/api/docs/pricing).

Gemini remains a possible adapter if the team selects its account terms, model availability, pricing and data controls after the same comparison. Provider choice is configurable, but Phase 3 should initially implement and test one provider to avoid split behavior and to keep scope controlled. No exact per-resume cost is promised: measure token usage, request count, cache-hit rate and real output size in evaluation before launch.

## Delivery sequence

Each module is a separately reviewable conventional commit. Database migration, API, UI, validation, error/loading/empty states and module tests land together where practical. Every shared-code change carries regression checks for existing technical tests, mock interview, roadmap, opportunities and dashboard.

| Order | Module | Planned work and acceptance |
|---|---|---|
| Foundation | Security and test prerequisites | Add test-only environment/bootstrap for JWT and isolated PostgreSQL; correct user ownership and add role claims/guards; audit every user-scoped route; add Helmet, CORS allow-list, central error handling, endpoint schemas, privacy-safe logging. Verify current modules retain behavior. Establish migration baseline and check true Git tracking/history before secret cleanup. |
| M1 | Resume upload | Add PDF/DOCX extension plus magic-byte validation, size/empty checks, randomized storage key outside static tree, hash-based dedupe, ownership-required record, safe delete/retention path. Keep current extraction and flow shape; do not report MIME as content validation. UI shows upload progress and clear validation errors. |
| M2 | Parse and review | Expand parser output to typed sections and per-field evidence/confidence; add OCR fallback for scanned PDF using installed Tesseract where feasible; save parsed version and candidate corrections. UI presents all requested fields in structured editable review and persists accepted corrections. Preserve original document and source text under access controls. |
| M3 | Resume analysis | Add provider-agnostic AI service, versioned prompt, strict JSON schema + server-side Zod validation, one bounded retry, safe rule fallback, timeouts and hash/prompt/model cache. Explain every suggestion with a reason and verbatim/located source evidence; do not invent missing candidate details. Add PII minimization, AI opt-in/notice, cost and token metrics without content. |
| M4 | JD analysis | Accept pasted text and validated PDF/DOCX/TXT upload (define limits); parse required/preferred skills, years/experience, education, responsibilities, tools/technologies and qualifications. Show editable structured result and persist it. |
| M5 | Matching | Relate match to owned resume and JD. Compute deterministic criterion matches from explicit weights, evidence and source locations; display matched/missing evidence and weighted breakdown. Keep hiring-outcome disclaimer. |
| M6 | Improvements | Produce suggestions for summary, bullets, skill emphasis, order/sections and role advice. Compare each output to candidate facts; accept only source-grounded claim-preserving rewrites. Persist review status; acceptance/rejection is explicit and auditable. Prevent arbitrary client-submitted text from being accepted as an AI rewrite without user edit confirmation. |
| M7 | Generation | Generate all existing templates as PDF/DOCX from approved structured candidate content; validate output format/template, persist generated file metadata, authorize download by owner, and support cleanup. Preserve export tests. |
| M8 | Dashboard | Integrate profile, resumes, parsed fields, analyses, skill matching, suggestions, generated files and protected downloads in the existing dashboard while keeping readiness modules. Every query is scoped to authenticated user; provide empty/loading/error states. |
| M9 | Reports (optional) | Persist and provide owner-scoped analysis, match, missing skills, improvement and profile summary exports; preserve PDF/CSV where useful. |

## Proposed API contract

All candidate endpoints require a bearer JWT. Client never supplies authoritative `userId`; server derives ownership from the verified principal. JSON errors use `{ "error": { "code": "...", "message": "...", "fields": [] } }` without stack traces. IDs are opaque strings. Enforce request-size and field-length bounds. Exact limits should be centralized and documented; initial upload ceiling remains 5 MiB pending the Open Question below.

| Endpoint | Request | Response / behavior |
|---|---|---|
| `POST /api/ats/resumes` (M1) | `multipart/form-data`: `resume` PDF/DOCX, `targetRole` string (2–80 chars). | `201 {resume:{id,filename,size,sha256,status,createdAt}}`; duplicate hash for same user returns existing record with `200` and `deduplicated:true`. Parse may be synchronous initially; status is `uploaded/parsed/needs_review/failed`. |
| `GET /api/ats/resumes` | Query: `cursor?`, `limit?` (bounded). | `200 {items:[{id,filename,targetRole,status,atsScore,createdAt}],nextCursor}`; metadata only. |
| `GET /api/ats/resumes/:id` | No body. | `200 {resume,parsedResume,analysis,latestMatch,improvements,generatedResumes}`; owner-scoped; raw text/file content omitted unless separately requested. |
| `GET /api/ats/resumes/:id/file` | No body. | Authorized original upload stream; safe content disposition and type. |
| `PATCH /api/ats/resumes/:id/parsed` (M2) | `{version,fields:{name,email,phone,summary,education,experience,skills,certifications,projects,tools,achievements}}`; field bounds and concurrency version. | `{parsedResume:{id,version,fields,updatedAt}}`; save correction and provenance; stale version `409`. |
| `POST /api/ats/resumes/:id/analyze` (M3) | `{refresh?:boolean}`. | `{analysis:{id,source,model,promptVersion,completeness,strengths[],weaknesses[],missingInformation[],suggestions[]}}`; each evidence item includes `field`, `quote`, and optional offsets; fallback identified. |
| `POST /api/ats/job-descriptions` (M4) | JSON `{text,title?}` OR multipart `{file}` (one input only). | `201 {jobDescription:{id,title,requirements:{requiredSkills[],preferredSkills[],experience[],education[],responsibilities[],tools[],qualifications[]}}}`. |
| `PATCH /api/ats/job-descriptions/:id` (M4) | `{requirements:...}` structured corrections, version. | Updated requirement object/version. |
| `POST /api/ats/matches` (M5) | `{resumeId,jobDescriptionId}`. | `{match:{id,score,disclaimer,criteria:[{key,weight,score,evidence[],missing[]}],matchedSkills[],missingSkills[],recommendations[]}}`; deterministic scoring algorithm version included. |
| `POST /api/ats/resumes/:id/improvements` (M6) | `{jobDescriptionId?}`. | `{suggestions:[{id,type,original,proposed,reason,evidence[],status:"pending"}]}`. No candidate document changes until reviewed. |
| `PATCH /api/ats/improvements/:id` (M6) | `{decision:"accept"|"reject",editedText?,version}`. | Updated decision and approved content; server revalidates claims and record owner. |
| `POST /api/ats/resumes/:id/generated` (M7) | `{template:"modern-clean"|"executive-classic"|"tech-minimal",format:"pdf"|"docx",parsedVersion}`. | `201 {generatedResume:{id,template,format,createdAt,downloadUrl}}`; only approved user content is included. |
| `GET /api/ats/generated/:id/download` (M7) | No body. | Authenticated owner-scoped file response. |
| `GET /api/dashboard/resume` (M8) | No body. | User-scoped summary of profile, resumes, parsed fields, latest analysis/matches/suggestions/exports. |
| `POST /api/ats/reports` (M9 optional) | `{resumeId,type:"analysis"|"match"|"profile",jobDescriptionId?}`. | `201 {report:{id,type,downloadUrl,createdAt}}`; user-scoped. |

Preserve compatibility routes during transition (`/analyze-resume`, `/update-candidate`, `/match-jd`, `/apply-improvement`, `/generate-resume`, `/generate-report`, `/resumes`, `/resume/:id`) as thin adapters or formally migrate current frontend in the same module commit. Do not expose legacy response fields to unowned records.

## Database changes and migration proposal

Current candidate/resume feature models exist but mostly permit nullable `userId`; no resume content hash, unique hash constraint, field provenance or correction versions exist. Add changes with forward-only Prisma migrations and explicit backfill/rollback notes:

1. **User:** add `role` enum/field default `CANDIDATE` (admin/recruiter only if those actors are actually in scope); retain `passwordHash` but make non-null for newly registered accounts. Existing legacy data needs a reviewed migration/backfill.
2. **Resume:** evolve `CandidateResume` into canonical `Resume` or retain current model to minimize churn. Add mandatory `userId`, `sha256`, `status`, `storageKey`, `originalFilename`, `detectedMime`, `parserVersion`, `createdAt`, `deletedAt`; unique `(userId, sha256)` and indexes `(userId, createdAt)`. Never store the local path as a public download identifier.
3. **ParsedResume:** add one-to-one record with `resumeId` unique, `version`, `fields Json`, `fieldEvidence Json`, `source`/`confidence` metadata, `updatedAt`; retain prior versions in `ParsedResumeRevision` or append-only audit records so user corrections are reviewable.
4. **ResumeAnalysis:** replace/relate legacy `AtsAnalysis`; mandatory user and resume IDs, `modelProvider`, `modelName`, `promptVersion`, `schemaVersion`, `cacheKey`, `result Json`, `source`, `createdAt`. Unique cache key scoped to user/model/prompt/parser versions.
5. **JobDescription:** mandatory owner, `contentHash`, `rawText`, `requirements Json`, `version`; unique `(userId, contentHash)` if deduplication desired. Index by owner/date.
6. **MatchResult:** mandatory owner/resume/JD relations, `algorithmVersion`, `weights Json`, `criteria Json`, `score`, disclaimer/version and `createdAt`; unique resume/JD/algorithm tuple to avoid duplicate calculation records or use explicit versioned history policy.
7. **ImprovementSuggestion:** mandatory owner/resume, optional JD, `type`, `originalText`, `proposedText`, `reason`, `evidence Json`, `status enum`, `acceptedText`, `promptVersion`, timestamps; index owner/resume/status.
8. **GeneratedResume:** mandatory owner/resume, parsed revision/version, template, format, `storageKey`, content hash and timestamps; unique key by explicit request/idempotency strategy; index owner/date.
9. **Report:** retain `CandidateReport` but enforce owner, relate to source analysis/match, store report key/format and expiry, index owner/date.
10. **Audit and cleanup:** add minimal ownership-safe audit events for correction/acceptance/deletion and a retention mechanism for uploads/exports. Avoid storing prompt text, resume content, or PII in operational logs.

Migration strategy: create additive tables/columns first; backfill owners only where trustworthy. Do not guess ownership for legacy null-owned records—quarantine inaccessible rows pending an explicit policy. Deploy application code that writes new schema, verify counts/constraints, then make fields mandatory and remove legacy paths in a later migration. Generate SQL and inspect it before apply. Use a disposable local database for CI/dev. Never run `db push` against an unverified Supabase target. Migrations are not produced in Phase 2.

## AI design

### Single service boundary

`services/aiService.js` exposes task operations independent of vendor (`analyzeResume`, `parseJobDescription`, `suggestImprovements`). Provider adapters own request formatting. Configuration: `AI_PROVIDER`, `AI_MODEL`, provider API key, `AI_TIMEOUT_MS`, token/output limits, and `AI_ENABLED`; no credentials in source. Default to deterministic fallback if provider is unavailable or schema/business validation fails. Do not retry provider failures other than one bounded retry for invalid structured output; respect `Retry-After` and circuit-break repeated upstream failures.

### Prompt files and schemas

Versioned prompts live in `backend/prompts/v1/` as readable text/JSON templates, with metadata and golden fixtures. Proposed prompts: `resume_analysis_v1`, `job_description_v1`, `resume_improvements_v1`. Every prompt treats resume/JD text as untrusted data and forbids following embedded instructions. Each output is strict JSON Schema and additionally validated with Zod. Reject unexpected keys, excessive strings/items, malformed evidence quotes, invalid enums and evidence not found in the submitted redacted source. One retry may include validation errors without echoing full PII; then call deterministic fallback.

Schemas:

- **Resume analysis:** `completeness: {score:0..100, missingSections:string[]}`, lists of `{item,reason,evidence:[{field,quote}]}` for strengths, weaknesses, missing information, suggestions.
- **JD extraction:** `{title, requiredSkills[], preferredSkills[], requiredExperience[], educationRequirements[], responsibilities[], toolsTechnologies[], preferredQualifications[]}`; every item includes evidence quote.
- **Improvements:** `{summary:{original,proposed,reason,evidence[]}|null, bullets:[{sourceField,original,proposed,reason,evidence[]}], skillsToHighlight:string[], structureAdvice[], missingSections[], roleAdvice[]}`. Skill names must be exact normalized source facts; no invented employer/title/degree/certificate/metric. Evidence must map to user source data. For suggested missing items, the output may request the user to add factual information, never fill it in.

### Data minimization and operational controls

Before provider request, remove name, email, phone, full address, URLs and other unnecessary direct identifiers; send only resume sections relevant to task and role/JD context. For analysis/matching, avoid sending full raw resume when parsed fields/evidence snippets suffice. Document exactly which sections go to provider, why, provider, model, retention configuration, opt-in notice, and how to disable cloud AI. Store AI result under user access control. Request stateless/non-storing behavior where supported and validate current provider/account retention settings. Do not claim zero retention based only on API defaults.

Timeout, bounded input/output, per-user rate budget, provider retry policy, prompt/model/schema-versioned cache keyed by HMAC of normalized resume content, JD hash and user ID; no raw hash logging. Record provider/model, elapsed time, input/output tokens, estimated cost, cache status and fallback reason without prompt, output, or candidate PII. Configure budget alerts externally. Keep the deterministic parser/evaluator as baseline and offline path.

## Stack confirmation

- Keep Node.js + Express, Prisma + PostgreSQL, plain HTML/CSS/JS, current PDF/DOCX libraries and existing module structure.
- Keep `pdf-parse` and Mammoth baseline; wire existing Tesseract only for scanned PDF fallback after fixture evaluation.
- Use existing OpenAI SDK; add `zod` for runtime schemas if not already transitive/direct. Keep Gemini package only if a second approved adapter is needed; retire hardcoded legacy singleton only after its active callers are moved or the routes are confirmed unneeded.
- Add `helmet`; keep `express-rate-limit` and tighten/configure it. Use a maintained PDF/DOCX signature detector or a small auditable magic-byte check for supported formats. Use a private local storage adapter for development and a configurable private object-storage adapter only if deployment requires it.
- Use Prisma migrations, not production `db push`, for schema evolution. Node runtime should be pinned to a supported version after confirming the actual deploy target.

## Test and verification plan

Tests are added as implementation progresses (no test execution is required in this planning-only phase):

1. **Unit:** parser/evidence mapping and normalization; scoring weights/explanations; upload signatures, size/type/hash; Zod schemas; provider timeout/retry/fallback/cache; grounding and anti-fabrication; export templates; auth/roles/ownership helpers.
2. **API/security:** login/signup/password/JWT; candidate A cannot read/update/match/generate/download candidate B's records; missing/invalid token; request schema bounds; error shape; rate limit; CORS and security headers; fake extension, spoofed MIME, malformed docs, path traversal.
3. **Database/migrations:** fresh PostgreSQL migration, legacy backfill with nullable ownership quarantined, uniqueness/deduplication, transaction behavior and delete/retention behavior.
4. **Document corpus:** clean PDF, messy two-column PDF, scanned PDF with OCR, DOCX, oversized, wrong type, empty, non-English, fake extension. Annotate expected fields independently; report per-field precision/recall/exact accuracy and sample limitations.
5. **AI evaluation:** fixed sanitized fixtures and schema-invalid/provider-failure responses; evidence quotes must map to source; anti-fabrication checks assert no new skills/employers/certifications/degrees/metrics; judge output quality against reviewed cases and disclose model variance.
6. **Feature/API integration:** JD sizes/domains and text/file; resume upload → parsed review → correction persistence → analysis → JD parse → matching breakdown → suggestion decision → generation → owner-authorized download → dashboard/report.
7. **Regression:** existing technical tests, communication tests, mock interview, roadmap, opportunities and dashboard; confirm no route/page removal and behavior is intact.
8. **UI:** responsive checks at desktop, laptop, tablet and mobile; keyboard and screen-reader labels; loading, empty, retry/error and unauthorized states.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross-user resume exposure through ID-based lookups/downloads | Ownership scope mandatory in each query, tests with two users, no anonymous fallback on candidate dashboards. |
| Incorrect migration mapping for legacy ownerless data | Do not infer; quarantine and document resolution before non-null constraints. Back up and test upgrade/rollback on a disposable copy. |
| AI adds unsupported claims | Source-evidence schema, deterministic claim matching, user acceptance, regression anti-fabrication fixtures, fallback on uncertainty. |
| PII exposure to provider/logs | Redact before request, minimize fields, privacy-safe logs, explicit opt-in, documented retention and provider settings. |
| Model and pricing changes | Environment configuration, usage/cost telemetry, golden evals, budget alerts, avoid pricing assumptions in code. |
| Parser misses columns/scans | Evaluate diverse annotated corpus; use OCR and layout-aware extraction where measurable improvement justifies complexity; allow candidate correction. |
| Existing career features regress | Module-by-module commits and required tests around touched shared code and full regression suite. |
| Environment leaks/history persist after deleting `.env` | Confirm source repository and Git history; rotate every previously stored credential; purge history only under explicit repository process. |

## Open Questions

1. **Provider/retention:** Approve OpenAI as initial provider and confirm API-account retention/data-processing settings are acceptable for resumes? If not, which approved provider/region/retention contract should be used?
2. **Upload limit and retention:** Keep current 5 MiB limit or raise it? How long should original resumes, generated files and reports be retained, and should users be able to delete them immediately?
3. **Roles:** Are admin and recruiter accounts in this release, or should all access be candidate-only with an admin role reserved for future use?
4. **Legacy null ownership:** Should old ownerless resume/analysis rows be quarantined for manual assignment, exported for review, or deleted? No ownership will be guessed.
5. **Scanned PDFs:** Confirm OCR (Tesseract) may process uploaded resume pages locally and whether page-count/time limits are required.
6. **Field schema:** Is the flat candidate editor shape acceptable initially, or should education/work/projects become repeatable structured records in the first release?
7. **Resume deduplication:** Should same-user, same-file-hash upload return the existing resume, or create a new resume version while avoiding duplicate bytes?
8. **Generated output:** Should accepted AI edits update the structured candidate record immediately, or remain a separate approved revision used only for generation until the candidate promotes it?
9. **Git/secrets:** What is the authoritative Git remote/repository? The inspected tree did not contain `.git`, so tracked status/history of `backend/.env`, CSVs and logs could not be verified. Rotate database/JWT/provider keys already present in that file regardless.
10. **Pricing policy:** What monthly AI spend ceiling and per-user request limit should be enforced? Current official rates change and must be checked when a model is selected.

## Files changed/created in Phases 1–2

- `docs/01_existing_project_assessment.md`
- `docs/02_gap_analysis.md`
- `docs/03_development_plan.md`

No application source, Prisma schema, migration, prompt, or frontend file was modified. Phase 3 requires approval of the plan and resolution (or explicit defaults) for the open questions above.

