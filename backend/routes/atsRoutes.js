const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prismaClient');
const mammoth = require('mammoth');
const { extractPdfText } = require('../services/documentTextService');
const { inspectDocument, validateDocxPackage, storeResume, sha256, MAX_UPLOAD_BYTES, PRIVATE_RESUME_DIR } = require('../utils/secureUpload');

const { parseResume, parseStructuredCandidate } = require('../utils/atsParser');
const { evaluateATS, GUIDANCE_NOTICE } = require('../utils/atsEvaluator');
const aiProviderService = require('../services/aiService');
const resumeExportService = require('../services/resumeExportService');
const reportService = require('../services/reportService');
const { requireAuth, requireCandidate } = require('../middleware/authMiddleware');
const { uploadLimiter, aiLimiter } = require('../middleware/rateLimiter');
const { logActivity } = require('../utils/activityLogger');
const { sanitizeCandidateUpdate, replaceBullet, isOwner } = require('../utils/candidateEdits');
const { signedDownloadPath } = require('../utils/downloadToken');
const { evaluateJobMatch } = require('../utils/jobMatchEvaluator');


// Buffer files until extension, size, signature, and package structure are verified.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

function handleResumeUpload(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError || err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'The uploaded file exceeds the 5 MiB limit.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ success: false, error: 'Unexpected file field. Upload a single file under "resume".' });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload failed.' });
    }
    next();
  });
}

function handleJdUpload(req, res, next) {
  upload.single('jdFile')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError || err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: 'The uploaded file exceeds the 5 MiB limit.' });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload failed.' });
    }
    next();
  });
}

async function findOwnedResume(id, userId, include = undefined) {
  if (!id || typeof id !== 'string' || id.length > 80) return null;
  return prisma.candidateResume.findFirst({ where: { id, userId }, ...(include ? { include } : {}) });
}

function buildFieldEvidence(candidate, sourceText) {
  const evidence = {};
  for (const [field, value] of Object.entries(candidate)) {
    if (field === 'rawText' || typeof value !== 'string' || !value.trim()) continue;
    const quote = value.trim().slice(0, 240);
    const index = sourceText.toLowerCase().indexOf(quote.toLowerCase());
    evidence[field] = index >= 0
      ? [{ quote, start: index, end: index + quote.length, confidence: 0.9 }]
      : [{ quote, start: null, end: null, confidence: 0.35 }];
  }
  return evidence;
}

function candidateToSections(candidate = {}) {
  return {
    Name: candidate.name || 'Missing', Email: candidate.email || 'Missing', Phone: candidate.phone || 'Missing',
    Summary: candidate.summary || 'Missing', Education: candidate.education || 'Missing', Experience: candidate.experience || 'Missing',
    Skills: candidate.skills || 'Missing', Tools: candidate.tools || 'Missing', Certifications: candidate.certifications || 'Missing',
    Projects: candidate.projects || 'Missing', Achievements: candidate.achievements || 'Missing'
  };
}

/**
 * 1 & 2. POST /api/ats/analyze-resume
 * Uploads resume, parses all 11 fields, evaluates ATS score, runs AI analysis & improvements
 */
async function analyzeResumeHandler(req, res) {
  let storedFile = null;
  try {
    const { targetRole } = req.body;
    const effectiveUserId = req.user.id;

    if (!targetRole || typeof targetRole !== 'string' || targetRole.trim().length < 2 || targetRole.length > 80) {
      return res.status(400).json({ success: false, error: "Target Job Role must be selected before analysis." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "Resume file (PDF or DOCX) is required." });
    }

    const fileInfo = inspectDocument(req.file.buffer, req.file.originalname);
    if (!fileInfo.ok) return res.status(400).json({ success: false, error: fileInfo.reason });
    if (fileInfo.ext === '.docx') await validateDocxPackage(req.file.buffer);

    const fileHash = sha256(req.file.buffer);
    const duplicate = await prisma.candidateResume.findFirst({ where: { userId: req.user.id, sha256: fileHash } });
    if (duplicate) {
      const parsedSections = candidateToSections(duplicate.parsedData || {});
      const evaluation = evaluateATS(parsedSections, duplicate.targetRole || targetRole);
      return res.status(200).json({
        success: true, deduplicated: true, resumeId: duplicate.id, status: duplicate.status,
        atsScore: duplicate.atsScore, match_score: duplicate.atsScore, atsFeedbackRows: evaluation.atsFeedbackRows,
        summary: evaluation.summary, scoreBreakdown: evaluation.scoreBreakdown, matchStats: evaluation.matchStats,
        guidanceNotice: GUIDANCE_NOTICE, parsed_sections: parsedSections,
        candidateRecord: duplicate.parsedData, aiAnalysis: duplicate.aiAnalysis, improvements: duplicate.improvements
      });
    }

    // 1. Extract Raw Text
    let resumeText = "";
    if (fileInfo.ext === '.pdf') {
      const extracted = await extractPdfText(req.file.buffer);
      resumeText = extracted.text;
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      resumeText = result.value;
    }

    if (!resumeText || resumeText.trim().length < 20) {
      return res.status(400).json({ success: false, error: "Could not extract readable text from the uploaded document. Please check the file." });
    }

    storedFile = await storeResume(req.file.buffer, fileInfo.ext);

    // 2. Parse All 11 Sections
    const parsedSections = parseResume(resumeText);
    const candidateRecord = parseStructuredCandidate(resumeText);
    delete candidateRecord.rawText;

    // 3. Rule-based ATS Evaluation
    const evaluation = evaluateATS(parsedSections, targetRole);

    // 4. AI Analysis (Strengths, Weaknesses, Missing Info, Suggestions with "Why")
    const aiAnalysis = await aiProviderService.analyzeResume(candidateRecord, targetRole, effectiveUserId);

    // 5. AI Improvements (Summary Rewrite & Side-by-Side Bullet Rewrites)
    const improvements = await aiProviderService.generateImprovements(candidateRecord, targetRole, '', effectiveUserId);

    // Persist the candidate record, reviewed suggestions, and compatibility analysis atomically.
    const { candidateResume, analysisRecord } = await prisma.$transaction(async tx => {
      const resume = await tx.candidateResume.create({
        data: {
          userId: effectiveUserId,
          filename: req.file.originalname,
          storedPath: storedFile.storageKey,
          sha256: fileHash,
          status: 'NEEDS_REVIEW',
          fileSize: req.file.size,
          mimeType: fileInfo.mimeType,
          targetRole,
          rawText: '',
          parsedData: candidateRecord,
          aiAnalysis,
          improvements,
          atsScore: evaluation.score,
          parsedVersions: { create: { version: 1, fields: candidateRecord, evidence: buildFieldEvidence(candidateRecord, resumeText) } }
        }
      });
      const suggestionRows = [];
      if (improvements.summaryRewrite && improvements.summaryRewrite !== candidateRecord.summary) {
        suggestionRows.push({
          userId: effectiveUserId, resumeId: resume.id, type: 'SUMMARY',
          originalText: candidateRecord.summary || '', proposedText: improvements.summaryRewrite,
          reason: improvements.summaryReason || 'Review this wording against the cited source text.',
          evidence: (improvements.summaryEvidence || []).map(quote => ({ field: 'summary', quote })),
          promptVersion: improvements.promptVersion || 'rule-based-v1'
        });
      }
      for (const suggestion of improvements.bulletRewrites || []) {
        if (!suggestion.originalBullet || suggestion.originalBullet === suggestion.improvedBullet) continue;
        const sourceField = String(candidateRecord.experience || '').includes(suggestion.originalBullet) ? 'experience' : 'projects';
        suggestionRows.push({
          userId: effectiveUserId, resumeId: resume.id, type: 'BULLET',
          originalText: suggestion.originalBullet, proposedText: suggestion.improvedBullet,
          reason: suggestion.reason || 'Review this wording against the cited source text.',
          evidence: [{ field: sourceField, quote: suggestion.originalBullet }],
          promptVersion: improvements.promptVersion || 'rule-based-v1'
        });
      }
      if (suggestionRows.length) await tx.improvementSuggestion.createMany({ data: suggestionRows });
      const analysis = await tx.atsAnalysis.create({
        data: { userId: effectiveUserId, resumeId: resume.id, filename: req.file.originalname, targetRole, parsedSections, atsScore: evaluation.score }
      });
      return { candidateResume: resume, analysisRecord: analysis };
    });

    // 7. Activity Log
    if (effectiveUserId) {
      try {
        await logActivity(
          effectiveUserId,
          "Resume",
          "UPLOAD",
          `Resume analyzed for ${targetRole} - ATS Score: ${evaluation.score}`,
          evaluation.score,
          "COMPLETED",
          { resumeId: candidateResume.id }
        );
      } catch (logErr) {
        console.warn(JSON.stringify({ event: 'activity_log_write_failed' }));
      }
    }

    // Final response (Maintains backwards compatibility + adds AI & editable fields)
    res.json({
      success: true,
      analysisId: analysisRecord.id,
      resumeId: candidateResume.id,
      match_score: evaluation.score,
      atsScore: evaluation.score,
      atsFeedbackRows: evaluation.atsFeedbackRows,
      summary: evaluation.summary,
      matchStats: evaluation.matchStats,
      scoreBreakdown: evaluation.scoreBreakdown,
      guidanceNotice: GUIDANCE_NOTICE,
      parsed_sections: parsedSections,
      candidateRecord,
      aiAnalysis,
      improvements
    });

  } catch (error) {
    if (storedFile) try { fs.unlinkSync(storedFile.absolutePath); } catch (e) { }
    console.error(JSON.stringify({ event: 'resume_analysis_failed', status: error.status || 500 }));
    const status = error.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? error.message : 'Resume analysis encountered an error.' });
  }
}

router.post('/analyze-resume', uploadLimiter, requireAuth, requireCandidate, aiLimiter, handleResumeUpload, analyzeResumeHandler);
router.post('/resumes', uploadLimiter, requireAuth, requireCandidate, aiLimiter, handleResumeUpload, analyzeResumeHandler);

// Analyze and persist a job description independently of a resume, so candidates can review M4 before matching.
router.post('/analyze-jd', uploadLimiter, requireAuth, requireCandidate, aiLimiter, handleJdUpload, async (req, res) => {
  try {
    if (req.body.jdText != null && typeof req.body.jdText !== 'string') {
      return res.status(400).json({ success: false, error: 'jdText must be text.' });
    }
    let jdText = req.body.jdText || '';
    const targetRole = typeof req.body.targetRole === 'string' ? req.body.targetRole.trim().slice(0, 80) : '';
    if (req.file && jdText.trim()) return res.status(400).json({ success: false, error: 'Provide job description text or a file, not both.' });

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.pdf') {
        const signature = req.file.buffer.subarray(0, Math.min(req.file.buffer.length, 1024)).toString('latin1');
        if (!signature.includes('%PDF-')) throw Object.assign(new Error('The file extension does not match a PDF signature.'), { status: 400 });
        jdText = (await extractPdfText(req.file.buffer)).text;
      } else if (ext === '.docx') {
        const info = inspectDocument(req.file.buffer, req.file.originalname);
        if (!info.ok) throw Object.assign(new Error(info.reason), { status: 400 });
        await validateDocxPackage(req.file.buffer);
        jdText = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
      } else if (ext === '.txt') {
        if (req.file.buffer.includes(0)) throw Object.assign(new Error('The text file is not valid UTF-8 text.'), { status: 400 });
        jdText = req.file.buffer.toString('utf8');
      } else {
        throw Object.assign(new Error('Job descriptions must be PDF, DOCX, or TXT files.'), { status: 400 });
      }
    }

    jdText = jdText.trim();
    if (jdText.length < 20 || jdText.length > 30000) {
      return res.status(400).json({ success: false, error: 'Job description text must be between 20 and 30000 characters.' });
    }

    const extractedJD = await aiProviderService.parseJobDescription(jdText, targetRole, req.user.id);
    const contentHash = sha256(Buffer.from(jdText.toLowerCase()));
    const existing = await prisma.jobDescription.findFirst({ where: { userId: req.user.id, contentHash }, select: { id: true } });
    const jobDescription = existing || await prisma.jobDescription.create({
      data: {
        userId: req.user.id, contentHash, title: extractedJD.title || targetRole || 'Job Description',
        targetRole: targetRole || null, rawText: jdText, extractedDetails: extractedJD
      }, select: { id: true }
    });

    return res.json({ success: true, jobDescriptionId: jobDescription.id, deduplicated: Boolean(existing), extractedJD });
  } catch (error) {
    console.error(JSON.stringify({ event: 'job_description_analysis_failed', status: error.status || 500 }));
    const status = error.status === 400 ? 400 : 500;
    return res.status(status).json({ success: false, error: status === 400 ? error.message : 'Failed to analyze Job Description.' });
  }
});

/**
 * 2. POST /api/ats/update-candidate
 * Allows the user to correct parsed fields in an editable form and re-evaluates
 */
router.post('/update-candidate', requireAuth, requireCandidate, aiLimiter, async (req, res) => {
  try {
    const { resumeId, candidateData, targetRole } = req.body;

    if (!resumeId || !candidateData) {
      return res.status(400).json({ success: false, error: "resumeId and candidateData are required." });
    }

    const existingResume = await findOwnedResume(resumeId, req.user.id);

    if (!existingResume) {
      return res.status(404).json({ success: false, error: "Resume record not found." });
    }

    const safeCandidate = sanitizeCandidateUpdate(candidateData);
    const role = targetRole || existingResume.targetRole || "Software Engineer";

    // Build synthesized sections for ATS evaluator
    const updatedSections = {
      Name: safeCandidate.name || "Missing",
      Email: safeCandidate.email || "Missing",
      Phone: safeCandidate.phone || "Missing",
      Summary: safeCandidate.summary || "Missing",
      Skills: safeCandidate.skills || "Missing",
      Tools: safeCandidate.tools || "Missing",
      Education: safeCandidate.education || "Missing",
      Experience: safeCandidate.experience || "Missing",
      Projects: safeCandidate.projects || "Missing",
      Certifications: safeCandidate.certifications || "Missing",
      Achievements: safeCandidate.achievements || "Missing"
    };

    // Re-evaluate score with updated data
    const evaluation = evaluateATS(updatedSections, role);

    // Re-run AI analysis and improvements
    const aiAnalysis = await aiProviderService.analyzeResume(safeCandidate, role, req.user.id);
    const improvements = await aiProviderService.generateImprovements(safeCandidate, role, '', req.user.id);

    // Update in database
    const updatedResume = await prisma.candidateResume.update({
      where: { id: resumeId },
      data: {
        parsedData: safeCandidate,
        status: 'REVIEWED',
        targetRole: role,
        atsScore: evaluation.score,
        aiAnalysis,
        improvements
      }
    });
    await prisma.parsedResumeVersion.create({
      data: { resumeId, version: await prisma.parsedResumeVersion.count({ where: { resumeId } }) + 1, fields: safeCandidate, evidence: buildFieldEvidence(safeCandidate, Object.values(safeCandidate).filter(value => typeof value === 'string').join('\n')), source: 'USER_REVIEW' }
    });

    res.json({
      success: true,
      message: "Candidate record updated successfully",
      resumeId: updatedResume.id,
      match_score: evaluation.score,
      atsScore: evaluation.score,
      atsFeedbackRows: evaluation.atsFeedbackRows,
      summary: evaluation.summary,
      matchStats: evaluation.matchStats,
      scoreBreakdown: evaluation.scoreBreakdown,
      guidanceNotice: GUIDANCE_NOTICE,
      parsed_sections: updatedSections,
      candidateRecord: safeCandidate,
      aiAnalysis,
      improvements
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'candidate_update_failed', status: error.status || 500 }));
    const status = error.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? error.message : 'Failed to update candidate record.' });
  }
});

/**
 * 4 & 5. POST /api/ats/match-jd
 * Enter or upload a Job Description, extract requirements, and compute matching/missing skills
 */
router.post('/match-jd', uploadLimiter, requireAuth, requireCandidate, aiLimiter, handleJdUpload, async (req, res) => {
  try {
    if (req.body.jdText != null && typeof req.body.jdText !== 'string') return res.status(400).json({ success: false, error: 'jdText must be text.' });
    let jdText = req.body.jdText || '';
    const { resumeId, targetRole } = req.body;
    const effectiveUserId = req.user.id;

    if (req.file && jdText.trim()) return res.status(400).json({ success: false, error: 'Provide job description text or a file, not both.' });

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.pdf') {
        const signature = req.file.buffer.subarray(0, Math.min(req.file.buffer.length, 1024)).toString('latin1');
        if (!signature.includes('%PDF-')) throw Object.assign(new Error('The file extension does not match a PDF signature.'), { status: 400 });
        const extracted = await extractPdfText(req.file.buffer);
        jdText = extracted.text;
      } else if (ext === '.docx') {
        const info = inspectDocument(req.file.buffer, req.file.originalname);
        if (!info.ok) throw Object.assign(new Error(info.reason), { status: 400 });
        await validateDocxPackage(req.file.buffer);
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        jdText = result.value;
      } else if (ext === '.txt') {
        if (req.file.buffer.includes(0)) throw Object.assign(new Error('The text file is not valid UTF-8 text.'), { status: 400 });
        jdText = req.file.buffer.toString('utf8');
      } else {
        throw Object.assign(new Error('Job descriptions must be PDF, DOCX, or TXT files.'), { status: 400 });
      }
    }

    if (!jdText || jdText.trim().length < 20 || jdText.length > 30000) {
      return res.status(400).json({ success: false, error: 'Job description text must be between 20 and 30000 characters.' });
    }

    // Fetch Candidate Resume
    let candidateRecord = null;
    let resumeRecord = null;
    if (resumeId) {
      resumeRecord = await findOwnedResume(resumeId, req.user.id);
      if (resumeRecord) {
        candidateRecord = resumeRecord.parsedData;
      }
    }

    if (!candidateRecord) {
      return res.status(400).json({ success: false, error: "A valid resumeId is required to perform job matching." });
    }

    // Extract JD Requirements
    const extractedJD = await aiProviderService.parseJobDescription(jdText, targetRole || resumeRecord.targetRole, effectiveUserId);

    // Save Job Description
    const jdHash = sha256(Buffer.from(jdText.trim().toLowerCase()));
    const savedJD = await prisma.jobDescription.findFirst({ where: { userId: effectiveUserId, contentHash: jdHash } }) || await prisma.jobDescription.create({
      data: {
        userId: effectiveUserId,
        contentHash: jdHash,
        title: extractedJD.title,
        targetRole: targetRole || resumeRecord.targetRole,
        rawText: jdText,
        extractedDetails: extractedJD
      }
    });

    // Evaluate Matching
    const { matchingSkills, missingSkills, matchScore, scoreBreakdown } = evaluateJobMatch(candidateRecord, extractedJD);
    const recommendations = missingSkills.map(skill => {
      const at = jdText.toLowerCase().indexOf(skill.toLowerCase());
      return {
        item: skill,
        why: `The job description lists ${skill} as required, but it was not found in the resume sections checked. Add it only if you have that skill and can provide truthful evidence.`,
        evidence: at >= 0 ? [{ source: 'jobDescription', quote: jdText.slice(Math.max(0, at - 60), Math.min(jdText.length, at + skill.length + 80)).trim() }] : []
      };
    });
    // Save JobMatch
    const jobMatch = await prisma.jobMatch.create({
      data: {
        userId: effectiveUserId,
        resumeId: resumeRecord.id,
        jobDescriptionId: savedJD.id,
        targetRole: extractedJD.title,
        matchScore,
        matchingSkills,
        missingSkills,
        scoreBreakdown,
        guidanceNotice: GUIDANCE_NOTICE
      }
    });

    res.json({
      success: true,
      matchId: jobMatch.id,
      matchScore,
      matchingSkills,
      missingSkills,
      scoreBreakdown,
      recommendations,
      extractedJD,
      guidanceNotice: GUIDANCE_NOTICE
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'job_match_failed', status: error.status || 500 }));
    const status = error.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? error.message : 'Failed to analyze Job Description.' });
  }
});

/**
 * 6. POST /api/ats/apply-improvement
 * Allows user to accept or reject summary rewrite or specific bullet rewrites
 */
router.post('/apply-improvement', requireAuth, requireCandidate, async (req, res) => {
  try {
    const { resumeId, type, itemIndex, acceptedText, action } = req.body;

    if (!resumeId || !['summary', 'bullet'].includes(type) || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'resumeId, valid type, and accept/reject action are required.' });
    }

    const resume = await findOwnedResume(resumeId, req.user.id);
    if (!resume) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    let parsed = resume.parsedData;
    const suggestion = type === 'summary'
      ? resume.improvements?.summaryRewrite && { originalBullet: parsed.summary || '', improvedBullet: resume.improvements.summaryRewrite }
      : resume.improvements?.bulletRewrites?.[Number(itemIndex)];
    if (!suggestion) return res.status(404).json({ success: false, error: 'Improvement suggestion not found.' });
    const suggestionRow = await prisma.improvementSuggestion.findFirst({
      where: { userId: req.user.id, resumeId, type: type.toUpperCase(), originalText: suggestion.originalBullet, proposedText: suggestion.improvedBullet, status: 'PENDING' }
    });

    if (action === 'accept') {
      if (type === 'summary') {
        const approved = resume.improvements?.summaryRewrite;
        if (!approved || acceptedText !== approved) return res.status(400).json({ success: false, error: 'Accept the exact reviewed summary suggestion.' });
        if (approved === parsed.summary) return res.status(400).json({ success: false, error: 'This summary suggestion does not change the current text.' });
        parsed.summary = approved;
      } else if (type === 'bullet') {
        if (!suggestion || acceptedText !== suggestion.improvedBullet) return res.status(400).json({ success: false, error: 'Accept the exact reviewed bullet suggestion.' });
        parsed = replaceBullet(parsed, suggestion.originalBullet, suggestion.improvedBullet);
      } else {
        return res.status(400).json({ success: false, error: 'Unsupported improvement type.' });
      }

      // Re-evaluate score
      const sections = {
        Name: parsed.name || "Missing",
        Email: parsed.email || "Missing",
        Phone: parsed.phone || "Missing",
        Summary: parsed.summary || "Missing",
        Skills: parsed.skills || "Missing",
        Tools: parsed.tools || "Missing",
        Education: parsed.education || "Missing",
        Experience: parsed.experience || "Missing",
        Projects: parsed.projects || "Missing",
        Certifications: parsed.certifications || "Missing",
        Achievements: parsed.achievements || "Missing"
      };

      const evaluation = evaluateATS(sections, resume.targetRole);

      await prisma.candidateResume.update({
        where: { id: resumeId },
        data: {
          parsedData: parsed,
          atsScore: evaluation.score
        }
      });
      await prisma.parsedResumeVersion.create({
        data: { resumeId, version: await prisma.parsedResumeVersion.count({ where: { resumeId } }) + 1, fields: parsed, evidence: buildFieldEvidence(parsed, Object.values(parsed).filter(value => typeof value === 'string').join('\n')), source: 'USER_ACCEPTED_IMPROVEMENT' }
      });
      if (suggestionRow) await prisma.improvementSuggestion.update({ where: { id: suggestionRow.id }, data: { status: 'ACCEPTED', acceptedText: acceptedText } });

      return res.json({
        success: true,
        message: "Improvement applied to candidate record",
        updatedAtsScore: evaluation.score,
        parsedData: parsed
      });
    }

    if (suggestionRow) await prisma.improvementSuggestion.update({ where: { id: suggestionRow.id }, data: { status: 'REJECTED' } });
    res.json({ success: true, message: 'Improvement rejected; candidate data is unchanged.' });
  } catch (error) {
    console.error(JSON.stringify({ event: 'improvement_apply_failed', status: error.status || 500 }));
    const status = error.status === 400 ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? error.message : 'Failed to process improvement action.' });
  }
});

/**
 * 7. POST /api/ats/generate-resume
 * Generates resume in PDF or DOCX format across 3 templates
 */
router.post('/generate-resume', requireAuth, requireCandidate, async (req, res) => {
  try {
    const { resumeId, templateName, format } = req.body;
    const effectiveUserId = req.user.id;
    const resumeRecord = await findOwnedResume(resumeId, effectiveUserId);
    const candidate = resumeRecord?.parsedData;
    if (!candidate) return res.status(404).json({ success: false, error: 'Resume not found.' });

    const selectedTemplate = templateName || "Modern Clean";
    const selectedFormat = (format || "pdf").toLowerCase();
    if (!['Modern Clean', 'Executive Classic', 'Tech Minimal'].includes(selectedTemplate)) {
      return res.status(400).json({ success: false, error: 'Unsupported resume template.' });
    }
    if (!['pdf', 'docx'].includes(selectedFormat)) return res.status(400).json({ success: false, error: 'Format must be PDF or DOCX.' });

    let exportResult;
    if (selectedFormat === 'docx') {
      exportResult = await resumeExportService.generateDOCX(candidate, selectedTemplate);
    } else {
      exportResult = await resumeExportService.generatePDF(candidate, selectedTemplate);
    }

    // Persist GeneratedResume record
    await prisma.generatedResume.create({
      data: {
        userId: effectiveUserId,
        resumeId: resumeRecord ? resumeRecord.id : null,
        templateName: selectedTemplate,
        content: candidate,
        pdfPath: selectedFormat === 'pdf' ? exportResult.filePath : null,
        docxPath: selectedFormat === 'docx' ? exportResult.filePath : null
      }
    });

    res.json({
      success: true,
      message: `Resume generated in ${selectedFormat.toUpperCase()} using '${selectedTemplate}' template`,
      downloadUrl: exportResult.url,
      filename: exportResult.filename
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'resume_generate_failed' }));
    res.status(500).json({ success: false, error: 'Failed to generate resume file.' });
  }
});

/**
 * 9. POST /api/ats/generate-report
 * Generates downloadable reports (PDF Analysis or CSV Skill-Match)
 */
router.post('/generate-report', requireAuth, requireCandidate, async (req, res) => {
  try {
    const { resumeId, type, targetRole } = req.body;

    if (!resumeId) {
      return res.status(400).json({ success: false, error: "resumeId is required." });
    }

    const resume = await findOwnedResume(resumeId, req.user.id);
    if (!resume) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    const role = targetRole || resume.targetRole || "Engineering Candidate";
    const reportType = (type || "pdf").toLowerCase();

    if (reportType === 'csv') {
      const evaluation = evaluateATS(candidateToSections(resume.parsedData), role);
      const result = reportService.generateSkillMatchCSV(resume.parsedData?.name || "Candidate", role, evaluation.matchStats);
      await prisma.candidateReport.create({ data: { userId: req.user.id, resumeId, reportType: 'csv', filename: result.filename } });
      return res.json({ success: true, downloadUrl: result.url, filename: result.filename });
    }

    // PDF Report
    const evaluation = evaluateATS(candidateToSections(resume.parsedData), role);
    const result = await reportService.generateAnalysisPDF(resume.parsedData, evaluation, resume.aiAnalysis, role);
    await prisma.candidateReport.create({ data: { userId: req.user.id, resumeId, reportType: 'pdf', filename: result.filename } });

    res.json({
      success: true,
      downloadUrl: result.url,
      filename: result.filename
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'report_generate_failed' }));
    res.status(500).json({ success: false, error: 'Failed to generate report.' });
  }
});

/**
 * Download static generated files (resumes or reports)
 */
router.get('/download/:filename', requireAuth, requireCandidate, async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename) return res.status(404).json({ success: false, error: 'File not found.' });
  try {
    const generated = await prisma.generatedResume.findFirst({
      where: { userId: req.user.id, OR: [{ pdfPath: { endsWith: filename } }, { docxPath: { endsWith: filename } }] }
    });
    const report = await prisma.candidateReport.findFirst({ where: { userId: req.user.id, filename } });
    const filePath = generated
      ? (generated.pdfPath || generated.docxPath)
      : report ? path.join(__dirname, '../uploads/reports', filename) : null;
    if (!filePath) return res.status(404).json({ success: false, error: 'File not found.' });
    const resolved = path.resolve(filePath);
    const allowedRoots = [path.resolve(__dirname, '../uploads/generated'), path.resolve(__dirname, '../uploads/reports')];
    if (!allowedRoots.some(root => resolved.startsWith(root + path.sep)) || !fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, error: 'File not found.' });
    }
    return res.download(resolved, filename);
  } catch {
    return res.status(500).json({ success: false, error: 'The download could not be completed.' });
  }
});

/**
 * 8. GET /api/ats/resumes
 * Returns resumes for current user (or all if dev)
 */
router.get('/resumes', requireAuth, requireCandidate, async (req, res) => {
  try {
    const where = { userId: req.user.id };

    const resumes = await prisma.candidateResume.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        filename: true,
        targetRole: true,
        atsScore: true,
        createdAt: true,
        parsedData: true
      }
    });

    res.json({ success: true, resumes });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not load resumes.' });
  }
});

router.get('/resumes/:id/file', requireAuth, requireCandidate, async (req, res) => {
  try {
    const resume = await findOwnedResume(req.params.id, req.user.id);
    if (!resume?.storedPath) return res.status(404).json({ success: false, error: 'Resume file not found.' });
    const key = path.basename(resume.storedPath);
    const filePath = path.resolve(PRIVATE_RESUME_DIR, key);
    if (!filePath.startsWith(PRIVATE_RESUME_DIR + path.sep) || !fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Resume file not found.' });
    res.type(resume.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(resume.filename).replace(/[\r\n"\\]/g, '_')}"`);
    return res.sendFile(filePath);
  } catch {
    return res.status(500).json({ success: false, error: 'Could not download resume.' });
  }
});

router.delete('/resumes/:id', requireAuth, requireCandidate, async (req, res) => {
  try {
    const resume = await findOwnedResume(req.params.id, req.user.id);
    if (!resume) return res.status(404).json({ success: false, error: 'Resume not found.' });
    const [generated, reports] = await Promise.all([
      prisma.generatedResume.findMany({ where: { userId: req.user.id, resumeId: resume.id } }),
      prisma.candidateReport.findMany({ where: { userId: req.user.id, resumeId: resume.id } })
    ]);
    await prisma.$transaction([
      prisma.improvementSuggestion.deleteMany({ where: { userId: req.user.id, resumeId: resume.id } }),
      prisma.candidateReport.deleteMany({ where: { userId: req.user.id, resumeId: resume.id } }),
      prisma.generatedResume.deleteMany({ where: { userId: req.user.id, resumeId: resume.id } }),
      prisma.atsAnalysis.deleteMany({ where: { userId: req.user.id, resumeId: resume.id } }),
      prisma.candidateResume.delete({ where: { id: resume.id } })
    ]);
    const privateFiles = [
      resume.storedPath && { root: PRIVATE_RESUME_DIR, relative: resume.storedPath },
      ...generated.flatMap(item => [item.pdfPath, item.docxPath].filter(Boolean).map(file => ({ file }))),
      ...reports.map(item => ({ file: path.join(__dirname, '../uploads/reports', item.filename) }))
    ].filter(Boolean);
    for (const entry of privateFiles) {
      const resolved = entry.root
        ? path.resolve(entry.root, path.basename(entry.relative))
        : path.resolve(entry.file);
      const allowedRoots = [PRIVATE_RESUME_DIR, path.resolve(__dirname, '../uploads/generated'), path.resolve(__dirname, '../uploads/reports')];
      if (allowedRoots.some(root => resolved.startsWith(root + path.sep))) {
        try { fs.unlinkSync(resolved); } catch (error) { if (error.code !== 'ENOENT') console.warn(JSON.stringify({ event: 'file_cleanup_failed' })); }
      }
    }
    return res.json({ success: true, deleted: true });
  } catch {
    return res.status(500).json({ success: false, error: 'Could not delete resume data.' });
  }
});

/**
 * GET /api/ats/resume/:id
 * Fetches full resume record by id
 */
router.get('/resume/:id', requireAuth, requireCandidate, async (req, res) => {
  try {
    const resume = await findOwnedResume(req.params.id, req.user.id, {
        matches: { orderBy: { createdAt: 'desc' }, take: 5 },
        generatedResumes: { orderBy: { createdAt: 'desc' }, take: 5 },
        legacyAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 }
    });

    if (!resume) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    const evaluation = evaluateATS(candidateToSections(resume.parsedData), resume.targetRole);
    res.json({
      success: true,
      resume: {
        id: resume.id, filename: resume.filename, targetRole: resume.targetRole, status: resume.status,
        atsScore: resume.atsScore, parsedData: resume.parsedData, aiAnalysis: resume.aiAnalysis,
        improvements: resume.improvements, matches: resume.matches, generatedResumes: resume.generatedResumes,
        parsedSections: candidateToSections(resume.parsedData), scoreBreakdown: evaluation.scoreBreakdown,
        atsFeedbackRows: evaluation.atsFeedbackRows, summary: evaluation.summary, createdAt: resume.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Could not load resume.' });
  }
});

module.exports = router;
