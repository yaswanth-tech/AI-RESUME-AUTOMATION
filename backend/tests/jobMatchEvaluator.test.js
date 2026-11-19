const assert = require('assert');
const { evaluateJobMatch, WEIGHTS } = require('../utils/jobMatchEvaluator');

function runJobMatchEvaluatorTests() {
  const result = evaluateJobMatch(
    { skills: 'Node.js', experience: '3 years building Python services', projects: 'Python service with PostgreSQL', education: "Bachelor's degree in Computer Science" },
    { requiredSkills: ['Node.js', 'Python', 'Go'], requiredExperience: ['3 years experience'], educationRequirements: ["Bachelor's degree"] }
  );
  assert.deepStrictEqual(result.matchingSkills, ['Node.js', 'Python']);
  assert.deepStrictEqual(result.missingSkills, ['Go']);
  assert.strictEqual(result.scoreBreakdown.skillsScore, 33);
  assert.strictEqual(result.scoreBreakdown.criteria.experience.yearsPoints, 10);
  assert.strictEqual(result.scoreBreakdown.criteria.experience.relevancePoints, 5);
  assert.deepStrictEqual(result.scoreBreakdown.criteria.experience.relevantMatchedSkills, ['Python']);
  assert.strictEqual(result.scoreBreakdown.educationScore, 15);
  assert.strictEqual(result.scoreBreakdown.structureScore, 10);
  assert.strictEqual(result.matchScore, 73);
  assert.strictEqual(Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0), 1);

  const empty = evaluateJobMatch({}, { requiredSkills: ['Rust'], requiredExperience: ['5 years'], educationRequirements: ['Master degree'] });
  assert.strictEqual(empty.matchScore, 0);
  assert.strictEqual(empty.scoreBreakdown.criteria.experience.relevancePoints, 0);
  console.log('✔ Explainable match weights, evidence, and missing requirements passed');
}

module.exports = runJobMatchEvaluatorTests;
if (require.main === module) runJobMatchEvaluatorTests();
