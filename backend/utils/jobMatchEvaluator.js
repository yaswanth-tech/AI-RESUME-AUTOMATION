const CANDIDATE_FIELDS = ['skills', 'tools', 'experience', 'projects', 'education', 'summary'];
const STRUCTURE_FIELDS = ['skills', 'education', 'experience', 'projects'];
const WEIGHTS = Object.freeze({ skills: 0.5, experience: 0.25, education: 0.15, structure: 0.1 });

function evaluateJobMatch(candidate = {}, jd = {}) {
  const candidateText = CANDIDATE_FIELDS.map(field => `${field}: ${candidate[field] || ''}`).join('\n').toLowerCase();
  const requiredSkills = Array.isArray(jd.requiredSkills) ? jd.requiredSkills.filter(skill => typeof skill === 'string' && skill.trim()) : [];
  const matchingSkills = requiredSkills.filter(skill => candidateText.includes(skill.toLowerCase()));
  const missingSkills = requiredSkills.filter(skill => !matchingSkills.some(found => found.toLowerCase() === skill.toLowerCase()));
  const skillEvidence = matchingSkills.map(skill => {
    const field = CANDIDATE_FIELDS.find(key => String(candidate[key] || '').toLowerCase().includes(skill.toLowerCase()));
    return { item: skill, field, quote: String(candidate[field] || '').slice(0, 300) };
  });

  const requiredYears = (jd.requiredExperience || []).join(' ').match(/(\d+)\+?\s+years?/i);
  const experienceEvidence = `${candidate.experience || ''}\n${candidate.projects || ''}`.trim();
  const candidateYears = experienceEvidence.match(/(\d+)\+?\s+years?/i);
  const yearsScore = requiredYears
    ? (candidateYears && Number(candidateYears[1]) >= Number(requiredYears[1]) ? 10 : 0)
    : (experienceEvidence ? 10 : 0);
  const relevantExperienceSkills = requiredSkills.filter(skill => experienceEvidence.toLowerCase().includes(skill.toLowerCase()));
  const experienceRelevanceScore = requiredSkills.length
    ? Math.round(relevantExperienceSkills.length / requiredSkills.length * 15)
    : (experienceEvidence ? 15 : 0);
  const experienceScore = yearsScore + experienceRelevanceScore;

  const educationRequirements = (jd.educationRequirements || []).join(' ').toLowerCase();
  const educationTokens = educationRequirements.split(/\W+/).filter(word => word.length > 3);
  const educationMatches = educationTokens.filter(word => candidate.education && candidate.education.toLowerCase().includes(word));
  const educationScore = !educationRequirements ? 15 : (educationMatches.length ? 15 : 0);
  const structurePresent = STRUCTURE_FIELDS.filter(field => String(candidate[field] || '').trim());
  const structureScore = Math.round(structurePresent.length / STRUCTURE_FIELDS.length * 10);
  const skillsScore = requiredSkills.length ? Math.round(matchingSkills.length / requiredSkills.length * 50) : 50;
  const matchScore = skillsScore + experienceScore + educationScore + structureScore;

  return {
    matchingSkills, missingSkills, matchScore,
    scoreBreakdown: {
      skillsScore, experienceScore, educationScore, structureScore, totalScore: matchScore,
      weights: WEIGHTS,
      criteria: {
        skills: { matched: matchingSkills, missing: missingSkills, evidence: skillEvidence, points: skillsScore, outOf: 50 },
        experience: {
          requirement: (jd.requiredExperience || []).join('; ') || 'No explicit years requirement',
          candidateEvidence: experienceEvidence, yearsRequirement: requiredYears?.[0] || null,
          candidateYears: candidateYears?.[0] || null, yearsPoints: yearsScore, yearsOutOf: 10,
          relevantMatchedSkills: relevantExperienceSkills, relevancePoints: experienceRelevanceScore,
          relevanceOutOf: 15, points: experienceScore, outOf: 25
        },
        education: {
          requirement: (jd.educationRequirements || []).join('; ') || 'No explicit education requirement',
          candidateEvidence: candidate.education || '', matchedRequirementTerms: educationMatches, points: educationScore, outOf: 15
        },
        structure: { present: structurePresent, points: structureScore, outOf: 10 }
      },
      algorithmVersion: 'v2'
    }
  };
}

module.exports = { evaluateJobMatch, WEIGHTS };
