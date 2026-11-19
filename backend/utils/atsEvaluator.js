/**
 * Standardized Two-Column ATS Evaluator (Rule-Based Base)
 * Strictly follows the Error vs. Correction data model.
 * Provides explainable score breakdown and ethical guidance notice.
 */
const fs = require('fs');
const path = require('path');

const KEYWORDS_PATH = path.join(__dirname, '../datasets/ats_keywords.json');

const GUIDANCE_NOTICE = "Note: This ATS score and feedback is algorithmic guidance based on structural patterns and keyword relevance. It is designed to assist your preparation, not to serve as an employer hiring prediction or selection guarantee.";

function evaluateATS(parsedSections, targetRoleName, customCriteria = null) {
  let data = { roles: [] };
  try {
    data = JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf8'));
  } catch (e) {
    data = { roles: [] };
  }

  // Find predefined role or synthesize from customCriteria / fallback
  let role = data.roles.find(r => r.name.toLowerCase() === (targetRoleName || '').toLowerCase());

  if (!role) {
    if (customCriteria && Array.isArray(customCriteria.requiredSkills) && customCriteria.requiredSkills.length > 0) {
      role = {
        name: targetRoleName || "Custom Role",
        requiredSkills: customCriteria.requiredSkills,
        preferredSkills: customCriteria.preferredSkills || [],
        keywords: customCriteria.keywords || []
      };
    } else {
      // General Engineering fallback role
      role = {
        name: targetRoleName || "General Technical Role",
        requiredSkills: ["Git", "Problem Solving", "Communication", "Teamwork", "Projects"],
        preferredSkills: ["Documentation", "Testing", "Deployment"],
        keywords: ["Development", "Code", "System", "Application"]
      };
    }
  }

  const atsFeedbackRows = [];
  const scores = { skills: 0, experience: 0, education: 0, structure: 0, density: 0 };
  const normalizedResumeText = Object.values(parsedSections || {}).join(' ').toLowerCase();

  // --- 1. RESUME STRUCTURE ---
  const coreSections = ['Skills', 'Education', 'Experience', 'Projects'];
  const missingCore = coreSections.filter(s => !parsedSections[s] || parsedSections[s] === "Missing");

  if (missingCore.length > 0) {
    atsFeedbackRows.push({
      section: "Structure",
      error: `❌ Missing Core Section: ${missingCore[0]}\nNo ${missingCore[0]} section detected. ATS scanners rely on standard section headings to index candidates.`,
      correction: `✅ Add a ${missingCore[0]} section:\nUse a standard header like "${missingCore[0]}".\n\nExample:\n## ${missingCore[0]}\n• Detail 2-4 items reflecting your practical background.`,
      impact: "High",
      potentialScoreGain: 10
    });
    scores.structure = Math.max(0, 10 - missingCore.length * 3);
  } else {
    atsFeedbackRows.push({
      section: "Structure",
      error: "Resume structure contains all essential sections but could be organized for faster scanability.",
      correction: "✅ Layout Tip:\nPlace your strongest section (Technical Skills or Experience) in the top third of page 1 to capture recruiter interest within 6 seconds.",
      impact: "Low",
      potentialScoreGain: 3
    });
    scores.structure = 10;
  }

  // --- 2. EDUCATION ---
  if (parsedSections.Education && parsedSections.Education !== "Missing") {
    const eduText = parsedSections.Education.toLowerCase();
    const hasDegree = ['btech', 'mtech', 'b.e.', 'm.e.', 'bs', 'ms', 'bachelor', 'master', 'phd', 'diploma', 'degree'].some(d => eduText.includes(d));
    const hasYear = /\b(19|20)\d{2}\b/.test(eduText);

    if (!hasDegree || !hasYear) {
      atsFeedbackRows.push({
        section: "Education",
        error: `❌ Incomplete Credentials:\n${!hasDegree ? 'Degree title' : 'Graduation year'} was not distinctly detected. ATS algorithms look for verified degree patterns.`,
        correction: `✅ Formatting Recommendation:\nState your degree name, university/institution, and passing year clearly.\n\nExample:\nBachelor of Technology in Computer Science, 2024\nABC University`,
        impact: "Medium",
        potentialScoreGain: 5
      });
      scores.education = 7;
    } else {
      atsFeedbackRows.push({
        section: "Education",
        error: "Education credentials are clear and parseable.",
        correction: "✅ Enhancement:\nInclude your GPA (if above 3.5 or equivalent) or relevant upper-level coursework to reinforce domain depth.",
        impact: "Low",
        potentialScoreGain: 2
      });
      scores.education = 15;
    }
  } else {
    atsFeedbackRows.push({
      section: "Education",
      error: "❌ Missing Education Section:\nNo educational qualifications detected. Most screening filters verify academic background.",
      correction: "✅ Action Required:\nAdd an Education section listing your latest degree, college name, and completion year.",
      impact: "High",
      potentialScoreGain: 15
    });
    scores.education = 0;
  }

  // --- 3. SKILLS MATCH ---
  const foundRequired = role.requiredSkills.filter(s => normalizedResumeText.includes(s.toLowerCase()));
  const missingRequired = role.requiredSkills.filter(s => !foundRequired.some(f => f.toLowerCase() === s.toLowerCase()));
  const skillMatchPct = role.requiredSkills.length > 0
    ? Math.round((foundRequired.length / role.requiredSkills.length) * 100)
    : 100;

  if (skillMatchPct < 60) {
    atsFeedbackRows.push({
      section: "Skills",
      error: `❌ Low Keyword Relevance (${skillMatchPct}%):\nKey requirements for ${role.name} are missing: ${missingRequired.slice(0, 3).join(', ')}.`,
      correction: `✅ Align Skills Naturally:\nEnsure genuine skills you possess are explicitly mentioned in your Skills and Project descriptions.\n\nExample:\nSkills: ${missingRequired.slice(0, 3).join(', ')}`,
      impact: "High",
      potentialScoreGain: 20
    });
  } else {
    atsFeedbackRows.push({
      section: "Skills",
      error: "Skills section has good alignment with target role requirements.",
      correction: "✅ Categorization Tip:\nGroup skills under clear sub-headings (e.g. Languages, Frameworks, Cloud, Databases) to optimize keyword extraction.",
      impact: "Low",
      potentialScoreGain: 5
    });
  }
  scores.skills = Math.round((skillMatchPct / 100) * 35);

  // --- 4. PROJECTS & WORK EXPERIENCE ---
  const expCombined = ((parsedSections.Experience || '') + ' ' + (parsedSections.Projects || '')).toLowerCase();
  const hasOutcomes = /%|reduced|increased|improved|saved|delivered|generated|automated|\$\d+|\b\d+\b/.test(expCombined);
  const actionVerbs = ['developed', 'implemented', 'managed', 'led', 'designed', 'optimized', 'collaborated', 'built', 'architected', 'created', 'maintained'];
  const foundVerbs = actionVerbs.filter(v => expCombined.includes(v));

  const hasExpOrProj = (parsedSections.Experience && parsedSections.Experience !== "Missing") ||
                       (parsedSections.Projects && parsedSections.Projects !== "Missing");

  if (!hasExpOrProj) {
    atsFeedbackRows.push({
      section: "Experience",
      error: "❌ No Practical Evidence:\nNeither work experience nor project entries were found. ATS and hiring managers require concrete evidence of applied knowledge.",
      correction: "✅ Immediate Fix:\nAdd a Projects section highlighting 2-3 applications or capstone assignments you have built, detailing tools used and outcomes.",
      impact: "High",
      potentialScoreGain: 25
    });
    scores.experience = 0;
  } else if (!hasOutcomes || foundVerbs.length < 2) {
    atsFeedbackRows.push({
      section: "Experience",
      error: `❌ Action & Impact Gap:\n${!hasOutcomes ? 'No measurable metrics (%, numbers) identified.' : ''} ${foundVerbs.length < 2 ? 'Action verbs could be stronger.' : ''}`,
      correction: "✅ Use Impact Formula:\nStart each bullet with an active verb + task + measurable result (e.g. 'Optimized REST API query throughput by 35% using database indexing').",
      impact: "Medium",
      potentialScoreGain: 12
    });
    scores.experience = 15;
  } else {
    atsFeedbackRows.push({
      section: "Experience",
      error: "Project/Experience bullets use active verbs and impact indicators.",
      correction: "✅ Refinement:\nUse the STAR framework (Situation, Task, Action, Result) for deeper clarity during technical screeners.",
      impact: "Low",
      potentialScoreGain: 5
    });
    scores.experience = 25;
  }

  // --- 5. CERTIFICATIONS / TOOLS / ACHIEVEMENTS ---
  const hasCert = parsedSections.Certifications && parsedSections.Certifications !== "Missing";
  const hasTools = parsedSections.Tools && parsedSections.Tools !== "Missing";
  const hasSummary = parsedSections.Summary && parsedSections.Summary !== "Missing";

  if (!hasCert && !hasTools) {
    atsFeedbackRows.push({
      section: "Certifications & Tools",
      error: "❌ No Certifications or Specialized Tools Listed:\nIndustry credentials or dedicated developer tool listings add validation to your profile.",
      correction: "✅ Add Specialized Credentials:\nList completed online specializations, certificates, or tool suites (Git, Docker, Postman, Linux).",
      impact: "Low",
      potentialScoreGain: 5
    });
    scores.density = 5;
  } else {
    atsFeedbackRows.push({
      section: "Profile Depth",
      error: "Supporting sections (Tools/Certifications/Summary) detected.",
      correction: "✅ Keep Current:\nEnsure license verification links and current software versions are up to date.",
      impact: "Low",
      potentialScoreGain: 2
    });
    scores.density = 10;
  }

  if (hasSummary) {
    scores.density += 5;
  }

  // Calculate Total Score
  let totalScore = scores.skills + scores.experience + scores.education + scores.structure + scores.density;
  if (totalScore < 15) totalScore = 15;
  if (totalScore > 98) totalScore = 98;

  const totalPossibleGain = atsFeedbackRows.reduce((sum, row) => sum + row.potentialScoreGain, 0);
  const estimatedImproved = Math.min(98, totalScore + Math.round(totalPossibleGain * 0.65));

  const summary = `Implementing the priority corrections above can raise your estimated ATS score from ${totalScore} to approximately ${totalScore + 8}–${estimatedImproved}.`;

  return {
    score: Math.round(totalScore),
    atsScore: Math.round(totalScore),
    atsFeedbackRows,
    summary,
    matchStats: {
      found: foundRequired,
      missing: missingRequired,
      pct: skillMatchPct
    },
    scoreBreakdown: {
      skillsScore: scores.skills,
      experienceScore: scores.experience,
      educationScore: scores.education,
      structureScore: scores.structure,
      densityScore: scores.density
    },
    guidanceNotice: GUIDANCE_NOTICE
  };
}

module.exports = { evaluateATS, GUIDANCE_NOTICE };
