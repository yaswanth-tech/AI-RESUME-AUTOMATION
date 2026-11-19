# ASCEND

ASCEND is an existing Node.js/Express, Prisma/PostgreSQL and plain HTML/JavaScript career platform. It includes resume analysis, profile review, job matching, resume export and reports, plus technical and communication tests, mock interviews, roadmaps, opportunities and a dashboard.

Resume analysis uses the deterministic parser and evaluator as a baseline. Optional OpenAI analysis and rewriting run through a single schema-validated service; `AI_ENABLED=false` leaves the app in deterministic mode. The output is career guidance, not a prediction of hiring success. AI suggestions must be reviewed before they are applied.

## Requirements

- Node.js 20 or newer
- PostgreSQL database
- A strong JWT secret of at least 24 characters
- Optional OpenAI API key if enabling AI

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` and `JWT_SECRET`. Keep `.env` local and never commit it.
2. Install and generate the Prisma client:

   ```sh
   cd backend
   npm install
   npx prisma generate
   ```

3. Review the migrations and target database before applying them. The ownership migration quarantines records without a verifiable owner; retain a backup and define a recovery policy before production rollout.

   ```sh
   npx prisma migrate deploy
   ```

4. Start the app with `npm start`, then open the configured `PORT` (default 3002). Run `npm test` for unit/regression suites or `npm run test:e2e` for the Supabase-backed flow using a temporary test account.

For local scanned-PDF OCR, Tesseract.js requires language data. Set `TESSDATA_DIR` to a local trained-data directory for offline operation. Without a local copy, Tesseract.js may fetch language data from its configured source. OCR is capped at eight pages per file.

## Security and privacy

- Resume uploads are limited to 5 MiB, checked by extension and signature, stored with random names and kept outside the frontend static directory. Downloads require an authenticated owner.
- Resume text is not retained in the `rawText` database column. Parsed fields, evidence, generated content and analysis remain personal data in PostgreSQL and private output directories; deployment storage and database encryption/backup policies must protect them.
- AI is disabled by default. When enabled, the service removes name, email, phone, URLs and detected street addresses and sends only selected resume sections (up to the configured input cap), the target role and task-specific context. Requests use `store: false`; this is not a promise of zero provider retention. Review provider terms and account data controls before enabling AI for real candidates.
- The OpenAI model defaults to `gpt-6-luna`; configure `AI_PROVIDER`, `AI_MODEL` and `OPENAI_API_KEY` as appropriate. Prices and availability change; check current provider pricing before deployment.

## Docs

- [Existing project assessment](docs/01_existing_project_assessment.md)
- [Gap analysis](docs/02_gap_analysis.md)
- [Development plan](docs/03_development_plan.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [AI integration](docs/AI_INTEGRATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [User manual](docs/USER_MANUAL.md)
- [Testing report](docs/testing_report.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Demo script](docs/DEMO_SCRIPT.md)
