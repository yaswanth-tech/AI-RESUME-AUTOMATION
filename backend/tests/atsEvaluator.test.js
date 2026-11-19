const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseResume } = require('../utils/atsParser');
const { evaluateATS, GUIDANCE_NOTICE } = require('../utils/atsEvaluator');

function runAtsEvaluatorTests() {
  console.log('--- Running ATS Evaluator Tests ---');

  const sweText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_swe_resume.txt'), 'utf8');
  const incText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_incomplete_resume.txt'), 'utf8');

  // Test 1: Strong resume evaluation
  const sweSections = parseResume(sweText);
  const sweEval = evaluateATS(sweSections, 'Backend Developer');

  assert(typeof sweEval.score === 'number', 'Score must be a number');
  assert(sweEval.score >= 70, `Strong resume should achieve high score, got ${sweEval.score}`);
  assert(Array.isArray(sweEval.atsFeedbackRows), 'Feedback rows must be an array');
  assert(sweEval.atsFeedbackRows.length > 0, 'Feedback rows must not be empty');
  assert(sweEval.scoreBreakdown, 'Score breakdown must exist');
  assert.strictEqual(sweEval.guidanceNotice, GUIDANCE_NOTICE, 'Guidance notice must be present');
  console.log(`✔ Test 1: Strong candidate evaluated successfully (Score: ${sweEval.score}/100)`);

  // Test 2: Incomplete resume evaluation
  const incSections = parseResume(incText);
  const incEval = evaluateATS(incSections, 'Backend Developer');
  assert(incEval.score < 60, `Incomplete resume should receive lower score, got ${incEval.score}`);
  assert(incEval.matchStats.missing.length > 0, 'Should detect missing required skills');

  const missingFeedback = incEval.atsFeedbackRows.some(r => r.impact === 'High');
  assert(missingFeedback, 'Incomplete resume must have High-impact feedback rows');
  console.log(`✔ Test 2: Incomplete resume correctly penalizes missing sections (Score: ${incEval.score}/100)`);

  // Test 3: Custom Role & Guidance Notice
  const customEval = evaluateATS(sweSections, 'Full Stack Architect', {
    requiredSkills: ['Node.js', 'React', 'Docker'],
    preferredSkills: ['Kubernetes']
  });
  assert(customEval.score > 50, 'Custom criteria evaluation succeeded');
  assert(customEval.guidanceNotice.includes('guidance'), 'Must include ethical guidance disclaimer');
  console.log('✔ Test 3: Custom role criteria and guidance notice validated');
}

module.exports = runAtsEvaluatorTests;

if (require.main === module) {
  runAtsEvaluatorTests();
}
