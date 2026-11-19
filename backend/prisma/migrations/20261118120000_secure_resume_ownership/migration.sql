-- Resume data with no provable owner is retained in a restricted quarantine table.
-- No user IDs are guessed during this migration.
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'ADMIN', 'RECRUITER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ImprovementStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE';
ALTER TABLE "CandidateResume" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
ALTER TABLE "CandidateResume" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW';
ALTER TABLE "CandidateResume" ADD COLUMN IF NOT EXISTS "storedPath" TEXT;
ALTER TABLE "JobDescription" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "AtsAnalysis" ADD COLUMN IF NOT EXISTS "resumeId" TEXT;

-- Older Supabase schemas used storagePath. Preserve its value before dropping the legacy column.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'CandidateResume' AND column_name = 'storagePath'
  ) THEN
    EXECUTE 'UPDATE "CandidateResume" SET "storedPath" = "storagePath" WHERE "storedPath" IS NULL';
    EXECUTE 'ALTER TABLE "CandidateResume" DROP COLUMN "storagePath"';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "QuarantinedLegacyRecord" (
  "id" TEXT NOT NULL,
  "sourceModel" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "record" JSONB NOT NULL,
  "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuarantinedLegacyRecord_pkey" PRIMARY KEY ("id")
);

-- Preserve legacy ownerless personal records before they are removed from active tables.
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'AtsAnalysis', r."id", to_jsonb(r)
FROM "AtsAnalysis" r WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."userId")
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'JobMatch', r."id", to_jsonb(r)
FROM "JobMatch" r WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."userId")
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'GeneratedResume', r."id", to_jsonb(r)
FROM "GeneratedResume" r WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."userId")
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'JobDescription', r."id", to_jsonb(r)
FROM "JobDescription" r WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."userId")
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'CandidateResume', r."id", to_jsonb(r)
FROM "CandidateResume" r WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = r."userId")
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'JobMatch', r."id", to_jsonb(r)
FROM "JobMatch" r WHERE r."resumeId" IN (
  SELECT cr."id" FROM "CandidateResume" cr WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = cr."userId")
)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "QuarantinedLegacyRecord" ("id", "sourceModel", "sourceId", "record")
SELECT gen_random_uuid()::text, 'AtsAnalysis', a."id", to_jsonb(a)
FROM "AtsAnalysis" a WHERE EXISTS (
  SELECT 1 FROM "CandidateResume" r WHERE r."userId" IS NULL AND r."filename" = a."filename" AND r."userId" = a."userId"
)
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "AtsAnalysis" WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "AtsAnalysis"."userId");
DELETE FROM "JobMatch" WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "JobMatch"."userId");
DELETE FROM "JobMatch" WHERE "resumeId" IN (
  SELECT cr."id" FROM "CandidateResume" cr WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = cr."userId")
);
DELETE FROM "AtsAnalysis" WHERE EXISTS (
  SELECT 1 FROM "CandidateResume" r WHERE r."userId" IS NULL AND r."filename" = "AtsAnalysis"."filename" AND r."userId" = "AtsAnalysis"."userId"
);
DELETE FROM "GeneratedResume" WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "GeneratedResume"."userId");
DELETE FROM "JobDescription" WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "JobDescription"."userId");
DELETE FROM "CandidateResume" WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "CandidateResume"."userId");

ALTER TABLE "CandidateResume" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AtsAnalysis" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "JobDescription" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "JobMatch" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "GeneratedResume" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "AtsAnalysis" DROP CONSTRAINT IF EXISTS "AtsAnalysis_userId_fkey";
ALTER TABLE "AtsAnalysis" ADD CONSTRAINT "AtsAnalysis_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateResume" DROP CONSTRAINT IF EXISTS "CandidateResume_userId_fkey";
ALTER TABLE "CandidateResume" ADD CONSTRAINT "CandidateResume_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobDescription" DROP CONSTRAINT IF EXISTS "JobDescription_userId_fkey";
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobMatch" DROP CONSTRAINT IF EXISTS "JobMatch_userId_fkey";
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedResume" DROP CONSTRAINT IF EXISTS "GeneratedResume_userId_fkey";
ALTER TABLE "GeneratedResume" ADD CONSTRAINT "GeneratedResume_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateReport" DROP CONSTRAINT IF EXISTS "CandidateReport_userId_fkey";
ALTER TABLE "CandidateReport" ADD CONSTRAINT "CandidateReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateReport" DROP CONSTRAINT IF EXISTS "CandidateReport_resumeId_fkey";
ALTER TABLE "CandidateReport" ADD CONSTRAINT "CandidateReport_resumeId_fkey"
  FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CandidateResume_userId_createdAt_idx" ON "CandidateResume"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CandidateResume_userId_sha256_key" ON "CandidateResume"("userId", "sha256");
CREATE INDEX IF NOT EXISTS "JobDescription_userId_createdAt_idx" ON "JobDescription"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "JobDescription_userId_contentHash_key" ON "JobDescription"("userId", "contentHash");
CREATE INDEX IF NOT EXISTS "JobMatch_userId_createdAt_idx" ON "JobMatch"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "GeneratedResume_userId_createdAt_idx" ON "GeneratedResume"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AtsAnalysis_userId_createdAt_idx" ON "AtsAnalysis"("userId", "createdAt");

UPDATE "AtsAnalysis" a SET "resumeId" = (
  SELECT r."id" FROM "CandidateResume" r
  WHERE r."userId" = a."userId" AND r."filename" = a."filename"
  ORDER BY ABS(EXTRACT(EPOCH FROM (r."createdAt" - a."createdAt"))) ASC
  LIMIT 1
) WHERE a."resumeId" IS NULL;
ALTER TABLE "AtsAnalysis" ADD CONSTRAINT "AtsAnalysis_resumeId_fkey"
  FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "AtsAnalysis_resumeId_idx" ON "AtsAnalysis"("resumeId");

CREATE TABLE IF NOT EXISTS "ParsedResumeVersion" (
  "id" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fields" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'RULE_BASED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParsedResumeVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParsedResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ParsedResumeVersion_resumeId_version_key" ON "ParsedResumeVersion"("resumeId", "version");
CREATE INDEX IF NOT EXISTS "ParsedResumeVersion_resumeId_createdAt_idx" ON "ParsedResumeVersion"("resumeId", "createdAt");

CREATE TABLE IF NOT EXISTS "ImprovementSuggestion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resumeId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "originalText" TEXT NOT NULL,
  "proposedText" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "ImprovementStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedText" TEXT,
  "promptVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImprovementSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImprovementSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImprovementSuggestion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ImprovementSuggestion_userId_resumeId_status_idx" ON "ImprovementSuggestion"("userId", "resumeId", "status");
