# Deployment guide

## Before deployment

1. Use Node.js 20+ and a PostgreSQL database dedicated to this environment.
2. Set `DATABASE_URL`, a unique random `JWT_SECRET` (32+ random characters), `PORT`, and an explicit `CORS_ORIGINS` list. Do not commit `.env` or print it in logs.
   For Supavisor hosts, the runtime defaults to transaction pooling on port 6543 with `pgbouncer=true`; Prisma CLI migrations continue to use the configured `DATABASE_URL` (usually session mode on port 5432). Set `DB_POOL_MODE=session` to opt out. Set `DB_CONNECTION_LIMIT` to budget app-side connections; default is 5 per Node process.
3. Keep `AI_ENABLED=false` until privacy review, provider-account controls, budget limits and the candidate notice are approved. If enabling AI, configure `AI_PROVIDER=openai`, a supported `AI_MODEL`, `OPENAI_API_KEY`, timeout/rate settings and optional cost rates.
4. Set `RESUME_STORAGE_DIR` to a persistent private volume outside the served frontend directory. Restrict directory access and backups. Ensure generated/reports directories are also private and durable if downloads must survive restarts.
5. For scanned documents, mount Tesseract trained data and set `TESSDATA_DIR`/`OCR_LANGUAGES`. Without local trained data, Tesseract.js may attempt to fetch it. Decide network policy and verify language data licensing/source.
6. Back up and inspect the database. Review `QuarantinedLegacyRecord` handling. Test `npx prisma migrate deploy` on a copy before production.

## Build/run

```sh
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm test
npm start
```

Place the app behind TLS termination and a reverse proxy with request timeouts consistent with `AI_TIMEOUT_MS`. Configure proxy body limits no lower than the documented 5 MiB file size plus multipart overhead. Monitor storage capacity, PostgreSQL backups, request/error counts, AI token/cost logs and rate-limit responses. Logs must not contain resume content or PII.

## Operational limitations

The current upload storage uses private filesystem permissions, not application-level encryption. Use encrypted volumes/backups and managed database encryption. Multi-instance deployments need shared private artifact storage or a storage adapter and distributed rate-limit/cache backends. The AI cache is in-memory per process. Session-like legacy practice modules may also use process-local state.
