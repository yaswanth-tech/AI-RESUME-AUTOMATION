const fs = require('fs');
const path = require('path');
const { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  Table, TableRow, TableCell, WidthType, BorderStyle, 
  AlignmentType, ShadingType 
} = require('docx');

async function createMasterProjectDoc() {
  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  };

  const headerShading = {
    fill: "4F46E5",
    type: ShadingType.CLEAR,
    color: "auto"
  };

  const altRowShading = {
    fill: "F8FAFC",
    type: ShadingType.CLEAR,
    color: "auto"
  };

  function createHeaderCell(text, widthPercent) {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: headerShading,
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 100, after: 100 }
      })],
      borders: tableBorder
    });
  }

  function createCell(text, widthPercent, isBold = false, isAlt = false) {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: isAlt ? altRowShading : undefined,
      children: [new Paragraph({
        children: [new TextRun({ text, bold: isBold, size: 19, color: "1E293B" })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 80, after: 80 }
      })],
      borders: tableBorder
    });
  }

  const techRows = [
    ["Frontend Framework & UI", "React 18, ReactDOM, Babel Standalone, Tailwind CSS", "Reactive component state, dark-mode responsive design, zero-bundle compilation"],
    ["Audio & Speech Processing", "Web Speech API (SpeechRecognition & SpeechSynthesis)", "Real-time speech-to-text input, female AI voice synthesis (pitch 1.15, rate 0.98)"],
    ["Backend Web Framework", "Node.js (v20+ LTS) & Express.js (v4.22)", "Non-blocking asynchronous RESTful architecture, modular route controllers"],
    ["Database & ORM", "PostgreSQL (Supabase) & Prisma ORM (v5.10)", "Type-safe relational schema, automated migrations, high-concurrency pooling"],
    ["Authentication & Security", "JWT, bcryptjs, Helmet, CORS, Rate-Limiting, Zod", "Stateless bearer authentication, salted password hashing, anti-brute-force"],
    ["Document Ingestion", "Multer (Memory Buffering) & Magic-Byte Validator", "Zero disk leakage, strict hex signature verification (%PDF-, PK zip headers)"],
    ["Document Text Extraction", "pdf-parse, pdfjs-dist, mammoth, tesseract.js OCR", "Text-layer token extraction, DOCX XML parsing, scanned document OCR fallback"],
    ["Document Generation", "pdfkit (v0.20) & docx (v9.15)", "Vector-accurate multi-template PDF exports, OpenXML Microsoft Word builder"],
    ["AI & Natural Language", "Google Gemini API, OpenAI API, Rule-Based Engine", "Generative STAR bullet rewrites, grounded ATS diagnostics, zero-downtime fallback"],
    ["Cloud & Hosting", "Vercel Serverless & GitHub", "Edge CDN static asset delivery, serverless API execution, CI version control"]
  ];

  const fileRows = [
    ["backend/server.js", "Backend Application Entry", "Configures Express, CORS, Helmet, static file hosting, route mounting, and error handling"],
    ["backend/routes/atsRoutes.js", "ATS & Resume Engine", "Upload validation, parsing, ATS scoring, JD matching, and PDF/DOCX generation"],
    ["backend/routes/interviewRoutes.js", "AI Mock Interview Controller", "State machine (Greeting, Readiness, Intro, Main, Closing), audio evaluation, report generator"],
    ["backend/routes/testRoutes.js", "Technical Assessment Controller", "CS proficiency assessments (Data Structures, Algorithms, OS, Networks, DBMS)"],
    ["backend/services/dashboardService.js", "Candidate Metrics Aggregator", "Normalizes scores (0-100%), computes overall readiness, and powers activity feeds"],
    ["backend/services/resumeExportService.js", "Multi-Template Document Builder", "Generates Modern Clean, Executive Classic, and Tech Minimal resumes in PDF/DOCX"],
    ["backend/prisma/schema.prisma", "Relational Database Schema", "Data models: User, CandidateResume, AtsAnalysis, InterviewSession, TechnicalTest"],
    ["frontend/mock_interview_session.html", "Interactive Interview Portal", "Audio visualizer, STT listening, female voice TTS, question capping, summary report view"],
    ["frontend/resume_upload.html", "ATS Workbench Interface", "Drag-and-drop file upload, section breakdown, STAR bullet rewrites, JD matcher"],
    ["frontend/dashboard.html", "Candidate Readiness Dashboard", "Overall readiness chart, module progress, resume history, and activity timeline"],
    ["frontend/js/userContext.js", "Global Auth & Identity Manager", "Manages bearer tokens, cached candidate profile, and authenticated file downloads"],
    ["api/index.js & vercel.json", "Vercel Deployment Gateway", "Directs serverless execution on Vercel's global edge network"]
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1200, bottom: 1200, left: 1400, right: 1400 }
        }
      },
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: "ASCEND — Complete Project Documentation", bold: true, size: 44, color: "4F46E5" })],
          spacing: { after: 150 }
        }),
        new Paragraph({
          children: [new TextRun({ text: "AI-Powered Career Preparation, ATS Resume Intelligence & Mock Interview Platform", italic: true, size: 22, color: "64748B" })],
          spacing: { after: 400 }
        }),

        // 1. Executive Summary
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "1. Executive Summary", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 250, after: 120 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: "ASCEND is an enterprise-grade AI Career Preparation and Resume Intelligence Platform engineered to empower candidates throughout modern recruitment pipelines. It automates Applicant Tracking System (ATS) evaluation across 11 canonical sections, provides explainable diagnostics with 'why' impact reasoning, performs weighted job description alignment, generates side-by-side STAR methodology improvements, exports production-ready resumes in PDF and DOCX formats across three professional templates, and delivers an immersive AI mock interview experience featuring natural female voice synthesis and real-time speech evaluation.",
            size: 21,
            color: "334155"
          })],
          spacing: { after: 200 }
        }),

        // 2. Comprehensive Technology Stack
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "2. Comprehensive Technology Stack", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 250, after: 120 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: "The platform integrates modern frontend reactive frameworks, high-throughput asynchronous Node.js micro-services, cloud relational databases, low-level document compilers, and artificial intelligence models with deterministic algorithmic fallbacks:",
            size: 21,
            color: "334155"
          })],
          spacing: { after: 150 }
        }),

        // Tech Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("Domain / Layer", 25),
                createHeaderCell("Technologies & Libraries", 35),
                createHeaderCell("Role & Architectural Purpose", 40)
              ]
            }),
            ...techRows.map((r, idx) => new TableRow({
              children: [
                createCell(r[0], 25, true, idx % 2 === 1),
                createCell(r[1], 35, false, idx % 2 === 1),
                createCell(r[2], 40, false, idx % 2 === 1)
              ]
            }))
          ]
        }),

        // 3. Technical File Architecture & Mapping
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "3. Technical File Architecture & Implementation Mapping", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 300, after: 120 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Every platform feature is modularly isolated across structured controllers, utility engines, services, and reactive frontend templates:",
            size: 21,
            color: "334155"
          })],
          spacing: { after: 150 }
        }),

        // File Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createHeaderCell("File Location", 30),
                createHeaderCell("Component / Role", 30),
                createHeaderCell("Technical Responsibility", 40)
              ]
            }),
            ...fileRows.map((r, idx) => new TableRow({
              children: [
                createCell(r[0], 30, true, idx % 2 === 1),
                createCell(r[1], 30, false, idx % 2 === 1),
                createCell(r[2], 40, false, idx % 2 === 1)
              ]
            }))
          ]
        }),

        // 4. Before vs. After: Technical Differences & Problem Fixes
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "4. Technical Evolution: Before vs. After Upgrades", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 300, after: 120 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "1. Mock Interview Question Count Capping:\n", bold: true, size: 21 }),
            new TextRun({ text: "• Previously: The frontend incremented local state on every click (readiness check, greeting), allowing questions to overflow up to 'Question 7 of 5'.\n• Now: The state machine caps strictly at 5 questions, automatically transitions to CLOSING/COMPLETED, and synchronizes real-time progress (1 to 5) directly from backend metadata.\n\n", size: 20 }),
            new TextRun({ text: "2. Interview Summary Report Crash Resolution:\n", bold: true, size: 21 }),
            new TextRun({ text: "• Previously: A ReferenceError ('average is not defined') in end-session crashed the server with HTTP 500, preventing candidates from seeing their final evaluation.\n• Now: Corrected variable bindings, wrapped logger in safe try/catch, and restored full summary reports with score breakdown, rubric evaluations, and candidate answer reviews.\n\n", size: 20 }),
            new TextRun({ text: "3. AI Voice Upgrade (Natural Female Voice Persona):\n", bold: true, size: 21 }),
            new TextRun({ text: "• Previously: The interview interface defaulted to robotic male system voices.\n• Now: Intelligent voice detection prioritizes Ava, Samantha, Jenny, Aria, and Zira with pitch tuned to 1.15 and rate 0.98 for clear, natural, professional vocal delivery.\n\n", size: 20 }),
            new TextRun({ text: "4. Unified Dashboard Metric Normalization:\n", bold: true, size: 21 }),
            new TextRun({ text: "• Previously: Interview scores were unnormalized raw attempt sums (e.g. 40/50 displayed as 40%) and technical tests used hardcoded user IDs.\n• Now: All module scores (Resume, Technical, Communication, Interview) scale cleanly to a 0–100% metric with dynamic user identity binding via UserContext.\n\n", size: 20 }),
            new TextRun({ text: "5. Production Deployment & Relative API Routing:\n", bold: true, size: 21 }),
            new TextRun({ text: "• Previously: Frontend files contained hardcoded 'http://localhost:3002' URLs that broke in cloud production.\n• Now: All API calls use relative paths ('/api/...'), ensuring zero-config compatibility locally and on Vercel Serverless.\n", size: 20 })
          ],
          spacing: { after: 200 }
        }),

        // 5. Automated Verification & Test Results
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "5. Quality Assurance & Automated Test Results", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 250, after: 120 }
        }),
        new Paragraph({
          children: [new TextRun({
            text: "All 9 automated test suites pass with 100% success rate under node backend/tests/run_tests.js:\n" +
                 "✔ ATS Parser Suite: 11 core sections tokenized, incomplete resume handling\n" +
                 "✔ ATS Evaluator Suite: Multi-factor scoring, penalty calculations\n" +
                 "✔ AI Grounding & Anti-Hallucination: Grounded feedback with 'why' reasoning\n" +
                 "✔ Authentication & Security: bcryptjs password hashing and JWT validation\n" +
                 "✔ Secure Upload Boundary: 5MB size limits and extension verification\n" +
                 "✔ Hex Magic-Byte Validation: Spoofed PDF and DOCX rejection\n" +
                 "✔ Explainable Job Description Match: Weighted keyword & gap analysis\n" +
                 "✔ Safe Route Logging: Production errors sanitized against data leakage\n" +
                 "✔ Resume Export Suite: Multi-template PDF & DOCX byte-level builds",
            size: 20,
            color: "0F766E"
          })],
          spacing: { after: 250 }
        }),

        // 6. Production Deployment Links
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "6. Production Deployment & Live Links", bold: true, size: 28, color: "1E293B" })],
          spacing: { before: 250, after: 120 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "• Live Production Application: ", bold: true, size: 21 }),
            new TextRun({ text: "https://ascend-nine-lilac.vercel.app\n", size: 21, color: "4F46E5" }),
            new TextRun({ text: "• GitHub Source Code Repository: ", bold: true, size: 21 }),
            new TextRun({ text: "https://github.com/yaswanth-tech/AI-RESUME-AUTOMATION\n", size: 21, color: "4F46E5" }),
            new TextRun({ text: "• Vercel Deployment Dashboard: ", bold: true, size: 21 }),
            new TextRun({ text: "https://vercel.com/yaswanthrajana255-7390s-projects/ascend\n", size: 21, color: "4F46E5" }),
            new TextRun({ text: "• Local Development Server: ", bold: true, size: 21 }),
            new TextRun({ text: "http://localhost:3002\n", size: 21 })
          ],
          spacing: { after: 200 }
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  
  // Save to docs/
  const docPath = path.resolve(__dirname, '../../docs/ASCEND_Complete_Project_Documentation.docx');
  fs.writeFileSync(docPath, buffer);
  console.log('DOCX written to:', docPath);

  // Save to frontend/assets/ for direct browser download
  const assetDir = path.resolve(__dirname, '../../frontend/assets');
  if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });
  const frontendDocPath = path.join(assetDir, 'ASCEND_Complete_Project_Documentation.docx');
  fs.writeFileSync(frontendDocPath, buffer);
  console.log('DOCX copied to frontend assets:', frontendDocPath);

  // Save root frontend download copy
  const rootFrontendDocPath = path.resolve(__dirname, '../../frontend/ASCEND_Complete_Project_Documentation.docx');
  fs.writeFileSync(rootFrontendDocPath, buffer);
  console.log('DOCX copied to root frontend:', rootFrontendDocPath);
}

createMasterProjectDoc().catch(console.error);
