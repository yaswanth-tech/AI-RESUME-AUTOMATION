const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseStructuredCandidate } = require('../utils/atsParser');
const aiProviderService = require('../services/aiProviderService');
const { hardClaimsAreSupported, candidateSource } = require('../services/aiProviderService');

async function runAIProviderTests() {
  console.log('--- Running AI Provider & Grounding Tests ---');

  const sweText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_swe_resume.txt'), 'utf8');
  const jdText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_jd.txt'), 'utf8');
  const candidate = parseStructuredCandidate(sweText);

  // Test 1: Resume Analysis (Strengths, Weaknesses, Missing Info, Suggestions with "Why")
  const analysis = await aiProviderService.analyzeResume(candidate, 'Backend Developer');
  assert(analysis.strengths && Array.isArray(analysis.strengths), 'Must return strengths array');
  assert(analysis.weaknesses && Array.isArray(analysis.weaknesses), 'Must return weaknesses array');
  assert(analysis.missingInfo && Array.isArray(analysis.missingInfo), 'Must return missingInfo array');
  assert(analysis.suggestions && Array.isArray(analysis.suggestions), 'Must return suggestions array');

  // Validate every entry has a non-empty "why"
  analysis.strengths.forEach(s => {
    assert(s.item && s.why, 'Every strength must have item and why explanation');
  });
  analysis.suggestions.forEach(s => {
    assert(s.item && s.why, 'Every suggestion must have item and why explanation');
  });
  console.log(`✔ Test 1: Resume analysis returns structured feedback with 'why' explanations (Source: ${analysis.source})`);

  // Test 2: Job Description Parsing
  const jdResult = await aiProviderService.parseJobDescription(jdText, 'Senior Backend Developer');
  assert(Array.isArray(jdResult.requiredSkills), 'requiredSkills must be array');
  assert(jdResult.requiredSkills.length > 0, 'Must extract required skills');
  assert(Array.isArray(jdResult.responsibilities), 'responsibilities must be array');
  assert(jdResult.experience, 'Must extract experience requirement');
  assert(jdResult.education, 'Must extract education requirement');
  console.log(`✔ Test 2: Job Description extracted: ${jdResult.requiredSkills.length} skills, experience & education`);

  // Test 3: Side-by-Side Improvements (Summary & Bullet Rewrites)
  const improvements = await aiProviderService.generateImprovements(candidate, 'Backend Developer', jdText);
  assert(typeof improvements.summaryRewrite === 'string', 'Summary rewrite must be string');
  assert(improvements.summaryRewrite.length > 20, 'Summary rewrite must be non-trivial');
  assert(Array.isArray(improvements.bulletRewrites), 'bulletRewrites must be array');
  assert(improvements.bulletRewrites.length > 0, 'bulletRewrites must not be empty');

  improvements.bulletRewrites.forEach(b => {
    assert(b.originalBullet, 'Must contain original bullet');
    assert(b.improvedBullet, 'Must contain improved bullet');
    assert(b.reason, 'Must contain reason explaining improvement');
  });
  console.log(`✔ Test 3: Side-by-side improvements generated: Summary rewrite and ${improvements.bulletRewrites.length} STAR bullets with reasons`);

  assert.strictEqual(candidateSource({ name: 'Alex Morgan', email: 'alex@example.com', phone: '(555) 111-2222', skills: 'Node.js' }).includes('Alex Morgan'), false);
  assert.strictEqual(candidateSource({ name: 'Alex Morgan', email: 'alex@example.com', phone: '(555) 111-2222', skills: 'Node.js' }).includes('alex@example.com'), false);
  assert.strictEqual(hardClaimsAreSupported('Reduced latency by 40%.', 'Reduced latency by 40%. Node.js'), true);
  assert.strictEqual(hardClaimsAreSupported('Reduced latency by 40%.', 'Improved latency. Node.js'), false);
  assert.strictEqual(hardClaimsAreSupported('Built React apps at Acme.', 'Built apps using JavaScript.'), false);
  const conservative = aiProviderService.ruleBasedImprovements({ summary: '', experience: '', projects: '' }, 'Backend Developer');
  assert.strictEqual(conservative.summaryRewrite, '', 'Fallback must not manufacture a candidate summary');
  assert.strictEqual(conservative.bulletRewrites.length, 0, 'Fallback must not manufacture candidate bullets');
  console.log('✔ PII minimization and anti-fabrication fallback checks passed');
}

module.exports = runAIProviderTests;

if (require.main === module) {
  runAIProviderTests().catch(console.error);
}
