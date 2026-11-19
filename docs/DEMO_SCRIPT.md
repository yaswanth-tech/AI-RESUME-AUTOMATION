# Local demo script

Use only a disposable local PostgreSQL database and the fictional sample resume fixture in `backend/tests/fixtures/`. Do not use a real candidate's document during a demo. Keep `AI_ENABLED=false` unless provider settings and privacy controls have been reviewed.

1. Start the backend and open the frontend. Sign up with a demo-only account.
2. Open Resume Analysis, upload `sample_swe_resume.txt` only after converting it to a PDF/DOCX locally, or use a separate fictional PDF/DOCX demo fixture. The upload screen accepts PDF and DOCX, not TXT.
3. Review extracted candidate fields. Correct a field, save, refresh, and verify the correction remains.
4. Enter a job description with required skills, experience, and education. Review structured requirements and matching/missing skills with the displayed weights and guidance notice.
5. Review improvement suggestions and their evidence. Reject one and confirm candidate data is unchanged; accept another only if the phrasing is accurate.
6. Generate PDF and DOCX using a template. Download through the authenticated link.
7. Generate a PDF report and CSV skill-match report. Return to the dashboard and review resume, analysis, suggestions and downloads.
8. Delete the demo resume and verify its record and generated artifacts are removed.
9. Visit the existing technical test, communication test, mock interview, roadmap and opportunities pages to demonstrate that career modules remain available.

Before a live demo, prepare a fictional PDF/DOCX fixture; the repository fixture is plain text and is not directly uploadable. This script is not evidence of a completed DB-backed E2E run; see [testing report](testing_report.md).
