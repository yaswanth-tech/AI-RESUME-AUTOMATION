const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');

async function createProjectDoc() {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, bottom: 1200, left: 1400, right: 1400 }
        }
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: "ASCEND — Complete Project Documentation", bold: true, size: 48, color: "4F46E5" })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "Career Preparation & Resume Intelligence Platform", italic: true, size: 24, color: "6B7280" })],
          spacing: { after: 400 }
        }),

        // Section 1
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "1. Executive Summary", bold: true, size: 32, color: "1E293B" })],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: "ASCEND is an AI-powered Career Preparation and Resume Intelligence Platform built to prepare candidates for hiring and ATS recruitment pipelines. It evaluates resumes across 11 core sections, provides grounded AI diagnosis with 'why' explanations, calculates weighted job description matches, enables STAR methodology improvements, exports professional multi-template PDF/DOCX resumes, and simulates AI mock interviews with a natural female voice.",
            size: 22
          })],
          spacing: { after: 250 }
        }),

        // Section 2
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "2. Key Platform Features", bold: true, size: 32, color: "1E293B" })],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "• Resume Upload Validation: ", bold: true, size: 22 }),
            new TextRun({ text: "Binary inspection checking %PDF- and ZIP 0x04034b50 headers, DOCX package verification, 5MB limit, and client drag-and-drop feedback.\n", size: 22 }),
            new TextRun({ text: "• 11-Section ATS Parser: ", bold: true, size: 22 }),
            new TextRun({ text: "Deterministic regex tokenization of Name, Email, Phone, Summary, Skills, Tools, Education, Experience, Projects, Certifications, and Achievements.\n", size: 22 }),
            new TextRun({ text: "• Explainable ATS Scoring: ", bold: true, size: 22 }),
            new TextRun({ text: "0-100 score evaluating contact completeness, section coverage, keyword density, and action verbs.\n", size: 22 }),
            new TextRun({ text: "• AI Diagnosis & Suggestions: ", bold: true, size: 22 }),
            new TextRun({ text: "Detailed strengths, weaknesses, missing info, and recommendations with 'Why this matters' reasoning.\n", size: 22 }),
            new TextRun({ text: "• Job Description Matching: ", bold: true, size: 22 }),
            new TextRun({ text: "Weighted skill overlap (50%), experience (25%), education (15%), and structure (10%) with green matching and red gap tags.\n", size: 22 }),
            new TextRun({ text: "• STAR Bullet Improvements: ", bold: true, size: 22 }),
            new TextRun({ text: "Side-by-side comparison cards with interactive Accept/Reject actions that perform clean in-place replacements.\n", size: 22 }),
            new TextRun({ text: "• Multi-Template Resume Generation: ", bold: true, size: 22 }),
            new TextRun({ text: "PDF and DOCX exports for Modern Clean, Executive Classic, and Tech Minimal templates.\n", size: 22 }),
            new TextRun({ text: "• AI Mock Interviewer (Female Voice): ", bold: true, size: 22 }),
            new TextRun({ text: "Real-time speech recognition and text-to-speech using Microsoft Zira / natural female voices with calibrated pitch.\n", size: 22 }),
            new TextRun({ text: "• Central Dashboard: ", bold: true, size: 22 }),
            new TextRun({ text: "Unified readiness tracking with deep links to resume workbench and generated file downloads.", size: 22 })
          ],
          spacing: { after: 250 }
        }),

        // Section 3
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "3. Technical Architecture & File Mapping", bold: true, size: 32, color: "1E293B" })],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "• Gateway & Server: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/server.js, api/index.js, vercel.json\n", size: 22 }),
            new TextRun({ text: "• Security & Auth: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/middleware/authMiddleware.js, backend/middleware/rateLimiter.js\n", size: 22 }),
            new TextRun({ text: "• Route Handlers: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/routes/atsRoutes.js, authRoutes.js, dashboardRoutes.js\n", size: 22 }),
            new TextRun({ text: "• Processing Engines: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/utils/secureUpload.js, atsParser.js, atsEvaluator.js, candidateEdits.js\n", size: 22 }),
            new TextRun({ text: "• AI & Export Services: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/services/aiProviderService.js, resumeExportService.js, reportService.js\n", size: 22 }),
            new TextRun({ text: "• Frontend Views: ", bold: true, size: 22 }),
            new TextRun({ text: "frontend/resume_upload.html, dashboard.html, index.html, mock_interview_session.html\n", size: 22 }),
            new TextRun({ text: "• Database Models: ", bold: true, size: 22 }),
            new TextRun({ text: "backend/prisma/schema.prisma (PostgreSQL / Supabase)", size: 22 })
          ],
          spacing: { after: 250 }
        }),

        // Section 4
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "4. Before vs. After: Technical Improvements", bold: true, size: 32, color: "1E293B" })],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "1. Upload Validation: ", bold: true, size: 22 }),
            new TextRun({ text: "Replaced raw disk upload with memory buffering, binary signature validation (%PDF- and ZIP checks), and clean 400 Bad Request error handling.\n", size: 22 }),
            new TextRun({ text: "2. Security & Auth: ", bold: true, size: 22 }),
            new TextRun({ text: "Fixed JWT secret export, passing 100% of test suites, and secured file download endpoints with ownership verification.\n", size: 22 }),
            new TextRun({ text: "3. Candidate Edits: ", bold: true, size: 22 }),
            new TextRun({ text: "Wired sanitizeCandidateUpdate across all 11 fields and added version tracking in ParsedResumeVersion.\n", size: 22 }),
            new TextRun({ text: "4. STAR Improvements: ", bold: true, size: 22 }),
            new TextRun({ text: "Integrated replaceBullet() for in-place bullet replacement instead of appending to section text.\n", size: 22 }),
            new TextRun({ text: "5. Dashboard Integration: ", bold: true, size: 22 }),
            new TextRun({ text: "Linked dashboard review buttons with resume IDs, hydrating the workbench state upon click.\n", size: 22 }),
            new TextRun({ text: "6. Mock Interview Voice: ", bold: true, size: 22 }),
            new TextRun({ text: "Added automatic selection of high-quality female voices (Microsoft Zira / Samantha) with calibrated pitch.\n", size: 22 }),
            new TextRun({ text: "7. Cloud Deployment: ", bold: true, size: 22 }),
            new TextRun({ text: "Configured Vercel serverless entry (api/index.js), vercel.json routing, and live deployment at https://ascend-nine-lilac.vercel.app.", size: 22 })
          ],
          spacing: { after: 250 }
        }),

        // Section 5
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "5. Production Deployment Links", bold: true, size: 32, color: "1E293B" })],
          spacing: { before: 300, after: 150 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "• GitHub Repository: ", bold: true, size: 22 }),
            new TextRun({ text: "https://github.com/yaswanth-tech/AI-RESUME-AUTOMATION\n", size: 22 }),
            new TextRun({ text: "• Live Vercel Production URL: ", bold: true, size: 22 }),
            new TextRun({ text: "https://ascend-nine-lilac.vercel.app\n", size: 22 }),
            new TextRun({ text: "• Vercel Project Dashboard: ", bold: true, size: 22 }),
            new TextRun({ text: "https://vercel.com/yaswanthrajana255-7390s-projects/ascend", size: 22 })
          ],
          spacing: { after: 200 }
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(__dirname, '../../docs/ASCEND_Complete_Project_Documentation.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('DOCX created at:', outPath);
}

createProjectDoc().catch(console.error);
