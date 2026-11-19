# Testing report

**Date:** 2026-11-19  
**Scope:** Implementation verification, Supabase migration and authenticated E2E flow.

## Automated checks

| Check | Result |
|---|---|
| `npm test` | Pass: 9 suites, 0 failures (parser, evaluator, AI fallback/grounding, auth helpers, upload validation, explainable JD match, safe route logging, PDF/DOCX export). |
| `npm run test:e2e` | Pass against Supabase: served JD card check, signup for two temporary candidates, DOCX upload/parse, cross-account resume isolation, independent JD analysis, resume/JD match, candidate correction, suggestion rejection, authenticated PDF and CSV downloads, dashboard visibility, resume deletion and cleanup of both accounts/artifacts. |
| `npx prisma validate` | Pass. |
| `npx prisma migrate status` | Pass: all 10 migrations applied. |
| Read-only Prisma schema diff | Pass: no differences between Supabase and Prisma schema. |
| `node --check` on server, ATS routes, AI service and PDF text service | Pass. |
| Inline JavaScript parse checks for login, resume, dashboard and roadmap pages plus shared user/tour scripts | Pass. |
| `npm start` | Pass: server starts on configured default port and reports deterministic fallback when AI is disabled/unavailable. Stopped after startup. |
| Native PDF text extraction regression | Pass using a generated PDF from the existing export test fixture; OCR is skipped when embedded text is available. |

## Not run / not verifiable in this environment

| Scenario | Status and reason |
|---|---|
| Migration rollout details | The eight already-present legacy migrations were baselined, then the two resume migrations were applied successfully. One ATS row with a non-existent user reference was quarantined; no owner was inferred. The authenticated database API flow is covered by the passing E2E row above. |
| Authenticated browser/API end-to-end flow | API E2E passed with a temporary test account; browser visual/responsive E2E remains unverified. |
| Clean, two-column, scanned, non-English or corrupted/oversized user documents | No project fixtures were present for these cases. Upload signature and limit unit checks pass, but extraction accuracy percentage cannot be calculated without a labeled test corpus. |
| OCR execution | OCR path is implemented with PDF.js, canvas and Tesseract.js, capped at 8 pages. No local trained-data directory or scanned fixture was available to demonstrate output. Configure `TESSDATA_DIR`; language data may otherwise be fetched by Tesseract.js. |
| Improvement acceptance persistence for live AI output | Rejection and unchanged candidate data are covered with the deterministic fallback. Accepting an actual AI rewrite is not exercised because AI/provider credentials remain disabled. |
| Responsive viewport checks | Not run; no browser E2E session was available. |
| Live OpenAI integration, cost and provider rate limits | Not run. AI is disabled by default and no provider credentials were used. |

## Coverage limits and follow-up

Parser accuracy fields (name, email, phone, summary, education, experience, skills, certifications, projects, tools, achievements) remain **unmeasured** on representative PDF/DOCX files. Do not interpret passing parser unit tests as a percentage of field-level extraction accuracy. Before production, add labeled layout-diverse document fixtures, exercise OCR with configured language data, test cross-account authorization and improvement decisions, and run browser checks at desktop/tablet/mobile widths.
