const prisma = require('../utils/prismaClient');

const WEIGHTS = {
  RESUME: 0.2,
  TECH: 0.3,
  COMM: 0.2,
  INTERVIEW: 0.2,
  ROADMAP: 0.1
};

async function getDashboardStats(userId) {
  if (!userId || typeof userId !== 'string') throw new Error('Authenticated user ID is required.');
  // 1. Fetch Latest Data from all modules
  const [
    user,
    candidateResume,
    legacyAts,
    techTests,
    commTest,
    interview,
    roadmap,
    savedOpps,
    activities,
    recentResumes,
    recentMatches,
    recentGenerated
  ] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId } }) : null,
    userId ? prisma.candidateResume.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }) : prisma.candidateResume.findFirst({ orderBy: { createdAt: 'desc' } }),
    userId ? prisma.atsAnalysis.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }) : prisma.atsAnalysis.findFirst({ orderBy: { createdAt: 'desc' } }),
    userId ? prisma.technicalTest.findMany({ where: { userId, status: 'COMPLETED' } }) : [],
    userId ? prisma.communicationTest.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }) : null,
    userId ? prisma.interviewSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }) : null,
    userId ? prisma.userRoadmapProgress.findFirst({ where: { userId } }) : null,
    userId ? prisma.userOpportunity.count({ where: { userId, status: 'SAVED' } }) : 0,
    userId ? prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }) : prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    userId ? prisma.candidateResume.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }) : prisma.candidateResume.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    userId ? prisma.jobMatch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }) : prisma.jobMatch.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    userId ? prisma.generatedResume.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }) : prisma.generatedResume.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  ]);

  // 2. Calculate Resume Score
  const activeResume = candidateResume || legacyAts;
  const resumeScore = activeResume ? (activeResume.atsScore || 0) : 0;
  const resumeStatus = !activeResume ? 'Not Started' : (resumeScore > 70 ? 'Strong' : 'Needs Work');

  // 3. Calculate Technical Score
  let techScore = 0;
  if (techTests.length > 0) {
    const total = techTests.reduce((sum, t) => sum + (t.totalScore / (t.maxScore || 100)) * 100, 0);
    techScore = total / techTests.length;
  }
  const techStatus = techTests.length === 0 ? 'Not Started' : (techScore > 70 ? 'Advanced' : 'Intermediate');

  // 4. Communication Score
  const commScore = commTest ? (commTest.totalScore || 0) : 0;
  const commStatus = !commTest ? 'Not Started' : (commScore > 70 ? 'Fluent' : 'Practice Needed');

  // 5. Mock Interview Score
  const interviewScore = interview ? (interview.totalScore || 0) : 0;
  const interviewStatus = !interview ? 'Not Started' : 'Completed';

  // 6. Roadmap Progress
  let roadmapScore = 0;
  let roadmapMeta = { phase: 1, progress: 0, nextAction: 'Select a Path' };

  if (roadmap) {
    const tasks = Array.isArray(roadmap.completedTasks) ? roadmap.completedTasks.length : 0;
    roadmapScore = Math.min((tasks / 20) * 100, 100);
    roadmapMeta = {
      phase: roadmap.currentPhase || 1,
      progress: Math.round(roadmapScore),
      nextAction: `Continue Phase ${roadmap.currentPhase || 1}`
    };
  }

  // 7. Overall Weighted Score
  const overallScore = Math.round(
    (resumeScore * WEIGHTS.RESUME) +
    (techScore * WEIGHTS.TECH) +
    (commScore * WEIGHTS.COMM) +
    (interviewScore * WEIGHTS.INTERVIEW) +
    (roadmapScore * WEIGHTS.ROADMAP)
  );

  // 8. Verdict & Insight
  let verdict = "Not Ready";
  let color = "red";
  if (overallScore > 70) { verdict = "Industry Ready"; color = "green"; }
  else if (overallScore > 40) { verdict = "Getting There"; color = "orange"; }

  let insight = "Start your journey by uploading a resume.";
  if (!activeResume) insight = "Upload your resume to get an initial ATS score.";
  else if (techTests.length === 0) insight = "Take a technical test to prove your skills.";
  else if (!commTest) insight = "Test your communication skills to boost your score.";
  else if (overallScore < 50) insight = "Focus on your weakest module to level up.";

  const userName = user?.name || 'Student';

  return {
    user: { name: userName, role: "Student" },
    overall: {
      score: overallScore,
      verdict,
      color,
      insight
    },
    modules: {
      resume: { score: Math.round(resumeScore), status: resumeStatus, attempted: !!activeResume, role: activeResume?.targetRole || 'Not Selected' },
      technical: { score: Math.round(techScore), status: techStatus, attempted: techTests.length > 0 },
      communication: { score: Math.round(commScore), status: commStatus, attempted: !!commTest },
      interview: { score: Math.round(interviewScore), status: interviewStatus, attempted: !!interview },
      roadmap: roadmapMeta,
      opportunities: { saved: savedOpps }
    },
    resumes: recentResumes.map(r => ({
      id: r.id,
      filename: r.filename,
      targetRole: r.targetRole,
      atsScore: r.atsScore,
      date: r.createdAt,
      status: r.status,
      candidateRecord: r.parsedData,
      analysis: r.aiAnalysis,
      improvements: r.improvements
    })),
    matches: recentMatches.map(m => ({
      id: m.id,
      role: m.targetRole,
      matchScore: m.matchScore,
      matchingCount: (m.matchingSkills || []).length,
      missingCount: (m.missingSkills || []).length,
      date: m.createdAt
    })),
    generatedResumes: recentGenerated.map(g => ({
      id: g.id,
      template: g.templateName,
      pdfUrl: g.pdfPath ? `/api/resume/download/${require('path').basename(g.pdfPath)}` : null,
      docxUrl: g.docxPath ? `/api/resume/download/${require('path').basename(g.docxPath)}` : null,
      date: g.createdAt
    })),
    activities
  };
}

module.exports = { getDashboardStats };
