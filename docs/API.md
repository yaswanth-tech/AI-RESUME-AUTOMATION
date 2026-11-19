# API reference

Base URL defaults to `http://localhost:3002/api`; set `PORT` and `CORS_ORIGINS` for deployment. Resume endpoints require `Authorization: Bearer <JWT>` for a candidate account. User IDs are derived from the token; clients must not send an owner ID to select records.

All request bodies are validated at route/service boundaries. Errors use `{ "success": false, "error": "..." }`; server errors do not return stack traces. Uploads are capped at 5 MiB.

## Authentication

| Method | Endpoint | Input / behavior |
|---|---|---|
| `POST` | `/auth/signup` | JSON `{name,email,password}`; password minimum 8 chars. Creates a candidate account and returns `{success,token,user}`. |
| `POST` | `/auth/login` | JSON `{email,password}` (legacy username field accepted); returns `{success,token,user}`. |
| `GET` | `/auth/me` | Authenticated current user. |

## Resume workflow

| Method | Endpoint | Input / behavior |
|---|---|---|
| `POST` | `/ats/analyze-resume` | Multipart fields `resume` (PDF/DOCX) and `targetRole`. Parses, scores, optionally analyzes, then returns `resumeId`, `candidateRecord`, `aiAnalysis`, `improvements`, `scoreBreakdown`, and guidance. |
| `POST` | `/ats/resumes` | Alias for resume analysis upload. |
| `POST` | `/ats/analyze-jd` | Multipart `jdText` or `jdFile` (PDF/DOCX/TXT), plus optional `targetRole`. Analyzes and saves structured JD requirements independently of a resume. |
| `GET` | `/ats/resumes` | Current user's resume list. |
| `GET` | `/ats/resume/:id` | Current user's resume details, analysis and scoring breakdown. |
| `GET` | `/ats/resumes/:id/file` | Download original file if owned by caller. |
| `DELETE` | `/ats/resumes/:id` | Deletes owned resume data and linked private generated/report files. |
| `POST` | `/ats/update-candidate` | JSON `{resumeId,targetRole?,candidateData}`. Candidate field correction is persisted and versioned. Fields: `name,email,phone,summary,education,experience,skills,certifications,projects,tools,achievements`. |
| `POST` | `/ats/match-jd` | Multipart text field `jdText` or file field `jdFile` (PDF/DOCX/TXT), plus `resumeId` and optional `targetRole`. Returns structured JD requirements, matching/missing skills, score breakdown, evidence and guidance notice. |
| `POST` | `/ats/apply-improvement` | JSON `{resumeId,type:"summary"|"bullet",itemIndex?,acceptedText,action:"accept"|"reject"}`. Acceptance must match the exact persisted suggestion. |
| `POST` | `/ats/generate-resume` | JSON `{resumeId,templateName,format:"pdf"|"docx"}`. Templates: `Modern Clean`, `Executive Classic`, `Tech Minimal`. Returns an authenticated `downloadUrl` and filename. |
| `POST` | `/ats/generate-report` | JSON `{resumeId,type:"pdf"|"csv",targetRole?}`. Returns authenticated download URL. |
| `GET` | `/ats/download/:filename` | Download only if the file metadata belongs to the current candidate. |

Resume upload requires extension and signature checks; DOCX additionally checks ZIP package structure. A duplicate content hash for the same owner returns the existing resume record rather than creating another.

The match score is deterministic, weighted guidance: required-skill overlap 50 points, experience 25 (10 for stated years and 15 for required skills found specifically in experience/projects), education requirement terms 15, and presence of skills/education/experience/projects sections 10. The response returns matched/missing skills, evidence quotes and the points for each criterion. It is not a hiring-success prediction.

## Dashboard/profile

- `GET /dashboard/stats` and `GET /dashboard/ats` require candidate authentication and return current-user dashboard data.
- `GET /user/current`, `GET /user/:id`, `POST /user/complete-tour` require candidate authentication; the profile route only permits the authenticated user's own ID.

Existing practice, mock-interview, opportunity and roadmap endpoints remain mounted as in the existing project. Their payloads are documented alongside their route implementations and are outside the resume API contract above.
