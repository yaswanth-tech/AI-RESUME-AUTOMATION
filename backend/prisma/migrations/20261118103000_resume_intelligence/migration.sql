-- Resume intelligence tables, stored resume files, and per-user reports.
-- Idempotent so it can apply after an earlier `prisma db push`.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "CandidateResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "targetRole" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedData" JSONB NOT NULL,
    "aiAnalysis" JSONB,
    "improvements" JSONB,
    "atsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CandidateResume_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CandidateResume" ADD COLUMN IF NOT EXISTS "storedPath" TEXT;

CREATE TABLE IF NOT EXISTS "JobDescription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "targetRole" TEXT,
    "rawText" TEXT NOT NULL,
    "extractedDetails" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "resumeId" TEXT NOT NULL,
    "jobDescriptionId" TEXT,
    "targetRole" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchingSkills" TEXT[],
    "missingSkills" TEXT[],
    "scoreBreakdown" JSONB NOT NULL,
    "guidanceNotice" TEXT NOT NULL DEFAULT 'This score is guidance based on automated pattern matching, not a hiring prediction or employment guarantee.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GeneratedResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "resumeId" TEXT,
    "templateName" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "pdfPath" TEXT,
    "docxPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedResume_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CandidateReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "reportType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateReport_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "CandidateResume" ADD CONSTRAINT "CandidateResume_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobDescriptionId_fkey"
    FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GeneratedResume" ADD CONSTRAINT "GeneratedResume_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GeneratedResume" ADD CONSTRAINT "GeneratedResume_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateReport" ADD CONSTRAINT "CandidateReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateReport" ADD CONSTRAINT "CandidateReport_resumeId_fkey"
    FOREIGN KEY ("resumeId") REFERENCES "CandidateResume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
