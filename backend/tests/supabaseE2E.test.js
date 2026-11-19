require('dotenv').config({ quiet: true });
const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prismaClient');
const { Document, Packer, Paragraph } = require('docx');
const { PRIVATE_RESUME_DIR } = require('../utils/secureUpload');

const backendDirectory = path.resolve(__dirname, '..');
const port = Number(process.env.E2E_PORT || 3013);
const baseUrl = `http://127.0.0.1:${port}`;
const testEmail = `ascend_e2e_${crypto.randomUUID()}@example.invalid`;
let server;
let token = '';
let userId = '';
let dashboardDiagnostic = '';
let resumeId = '';

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const details = new URL(url).pathname === '/api/dashboard/stats' && dashboardDiagnostic ? ` (diagnostic ${dashboardDiagnostic})` : '';
    throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}: ${payload.error || payload.message || 'request failed'}${details}`);
  }
  return payload;
}

function authHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${token}` };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode != null) throw new Error(`Backend exited before health check (code ${server.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await wait(400);
  }
  throw new Error('Backend did not become healthy within 20 seconds.');
}

async function createFixtureDocx() {
  const sourceText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_swe_resume.txt'), 'utf8');
  const doc = new Document({ sections: [{ children: sourceText.split(/\r?\n/).map(line => new Paragraph(line || ' ')) }] });
  return Packer.toBuffer(doc);
}

async function cleanupTestAccounts() {
    const testUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'ascend_e2e_', endsWith: '@example.invalid' } },
      select: { id: true }
    });
    for (const testUser of testUsers) {
      const testUserId = testUser.id;
      const resumes = await prisma.candidateResume.findMany({ where: { userId: testUserId }, select: { storedPath: true } });
      for (const resume of resumes) {
        const key = path.basename(resume.storedPath || '');
        if (key) {
          const candidatePath = path.resolve(PRIVATE_RESUME_DIR, key);
          if (candidatePath.startsWith(PRIVATE_RESUME_DIR + path.sep)) {
            try { fs.unlinkSync(candidatePath); } catch { /* test cleanup tolerates missing artifacts */ }
          }
        }
      }
      const generated = await prisma.generatedResume.findMany({ where: { userId: testUserId }, select: { pdfPath: true, docxPath: true } });
      const reports = await prisma.candidateReport.findMany({ where: { userId: testUserId }, select: { filename: true } });
      const artifactRoots = [path.resolve(backendDirectory, 'uploads/generated'), path.resolve(backendDirectory, 'uploads/reports')];
      const artifactPaths = generated.flatMap(row => [row.pdfPath, row.docxPath].filter(Boolean));
      artifactPaths.push(...reports.map(row => path.resolve(backendDirectory, 'uploads/reports', path.basename(row.filename))));
      for (const file of artifactPaths) {
        const resolved = path.resolve(file);
        if (artifactRoots.some(root => resolved.startsWith(root + path.sep))) {
          try { fs.unlinkSync(resolved); } catch { /* test cleanup tolerates missing artifacts */ }
        }
      }
      await prisma.user.deleteMany({ where: { id: testUserId, email: { startsWith: 'ascend_e2e_', endsWith: '@example.invalid' } } });
    }
}

async function cleanup() {
  try {
    await cleanupTestAccounts();
  } finally {
    if (server && server.exitCode == null) server.kill();
    await prisma.$disconnect();
  }
}

async function run() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error('Configure the local backend DATABASE_URL and JWT_SECRET before running the Supabase E2E test.');
  }
  await cleanupTestAccounts();
  server = spawn(process.execPath, ['server.js'], {
    cwd: backendDirectory,
    env: { ...process.env, PORT: String(port), CORS_ORIGINS: `http://localhost:${port}`, AI_ENABLED: 'false' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  server.stderr.on('data', chunk => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      try {
        const event = JSON.parse(line);
        if (event.event === 'dashboard_stats_failed') dashboardDiagnostic = `${event.category}:${event.errorCode}`;
      } catch { /* ignore non-structured diagnostics */ }
    }
  });

  try {
    await waitForServer();
    const resumePage = await fetch(`${baseUrl}/resume_upload.html`);
    const resumePageHtml = await resumePage.text();
    assert(resumePage.ok && resumePageHtml.includes('id="jdAnalysisCard"'), 'resume page must display the standalone JD analysis card');
    assert(resumePageHtml.includes('/api/ats/analyze-jd'), 'resume page must call the JD analysis endpoint');

    const signup = await requestJson(`${baseUrl}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ASCEND E2E Candidate', email: testEmail, password: `Test-${crypto.randomUUID()}-Pass!` })
    });
    token = signup.token;
    userId = signup.user.id;
    assert(token && userId, 'signup must return an authenticated candidate');

    const file = await createFixtureDocx();
    const uploadForm = new FormData();
    uploadForm.append('resume', new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'fixture.docx');
    uploadForm.append('targetRole', 'Backend Developer');
    const uploaded = await requestJson(`${baseUrl}/api/ats/analyze-resume`, { method: 'POST', headers: authHeaders(), body: uploadForm });
    resumeId = uploaded.resumeId;
    assert(resumeId && uploaded.candidateRecord, 'resume upload must persist parsed candidate fields');
    assert(uploaded.candidateRecord.skills, 'fixture resume should extract skills');

    const foreignSignup = await requestJson(`${baseUrl}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ASCEND E2E Other Candidate', email: `ascend_e2e_${crypto.randomUUID()}@example.invalid`, password: `Test-${crypto.randomUUID()}-Pass!` })
    });
    const foreignResumeResponse = await fetch(`${baseUrl}/api/ats/resume/${encodeURIComponent(resumeId)}`, {
      headers: { Authorization: `Bearer ${foreignSignup.token}` }
    });
    assert.strictEqual(foreignResumeResponse.status, 404, 'another candidate must not read this resume');

    const jdText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_jd.txt'), 'utf8');
    const jdForm = new FormData();
    jdForm.append('targetRole', 'Backend Developer');
    jdForm.append('jdText', jdText);
    const analyzedJD = await requestJson(`${baseUrl}/api/ats/analyze-jd`, { method: 'POST', headers: authHeaders(), body: jdForm });
    assert(analyzedJD.jobDescriptionId && analyzedJD.extractedJD, 'independent JD analysis must persist structured requirements');

    const matchForm = new FormData();
    matchForm.append('resumeId', resumeId);
    matchForm.append('targetRole', 'Backend Developer');
    matchForm.append('jdText', jdText);
    const match = await requestJson(`${baseUrl}/api/ats/match-jd`, { method: 'POST', headers: authHeaders(), body: matchForm });
    assert(Number.isFinite(match.matchScore), 'JD matching must return a numeric score');
    assert.strictEqual(match.scoreBreakdown.weights.skills, 0.5);
    assert(match.scoreBreakdown.criteria.experience && match.scoreBreakdown.criteria.education, 'match response should explain experience and education criteria');

    if (uploaded.improvements?.summaryRewrite) {
      const rejected = await requestJson(`${baseUrl}/api/ats/apply-improvement`, {
        method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ resumeId, type: 'summary', acceptedText: uploaded.improvements.summaryRewrite, action: 'reject' })
      });
      assert(rejected.success, 'candidate must be able to reject a proposed summary');
    }

    const correction = await requestJson(`${baseUrl}/api/ats/update-candidate`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resumeId, candidateData: { ...uploaded.candidateRecord, summary: 'Candidate corrected this summary during the integration test.' } })
    });
    assert.strictEqual(correction.candidateRecord.summary, 'Candidate corrected this summary during the integration test.');

    const generated = await requestJson(`${baseUrl}/api/ats/generate-resume`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resumeId, templateName: 'Modern Clean', format: 'pdf' })
    });
    const download = await fetch(`${baseUrl}/api/ats/download/${encodeURIComponent(generated.filename)}`, { headers: authHeaders() });
    assert(download.ok && (download.headers.get('content-type') || '').includes('pdf'), 'generated PDF should download for its owner');

    const reports = await requestJson(`${baseUrl}/api/ats/generate-report`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resumeId, type: 'csv' })
    });
    const reportDownload = await fetch(`${baseUrl}/api/ats/download/${encodeURIComponent(reports.filename)}`, { headers: authHeaders() });
    assert(reportDownload.ok && (reportDownload.headers.get('content-type') || '').includes('text/csv'), 'CSV report should download for its owner');

    const dashboard = await requestJson(`${baseUrl}/api/dashboard/stats`, { headers: authHeaders() });
    assert(Array.isArray(dashboard.data.resumes) && dashboard.data.resumes.some(item => item.id === resumeId), 'dashboard should show the candidate resume');

    const deleted = await requestJson(`${baseUrl}/api/ats/resumes/${encodeURIComponent(resumeId)}`, { method: 'DELETE', headers: authHeaders() });
    assert.strictEqual(deleted.deleted, true);
    resumeId = '';
    console.log('Supabase resume-to-JD-to-match-to-export-to-dashboard E2E passed. Temporary account/data are cleaned up.');
  } finally {
    await cleanup();
  }
}

run().catch(error => {
  console.error(`Supabase E2E failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (server && server.exitCode == null) server.kill();
  await prisma.$disconnect();
});
