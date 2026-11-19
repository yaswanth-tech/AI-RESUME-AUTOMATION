const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseResume, parseStructuredCandidate } = require('../utils/atsParser');

function runAtsParserTests() {
  console.log('--- Running ATS Parser Tests ---');

  const sweText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_swe_resume.txt'), 'utf8');
  const incompleteText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_incomplete_resume.txt'), 'utf8');

  // Test 1: Complete resume extraction
  const sections = parseResume(sweText);
  assert.strictEqual(sections.Name, 'Alex Morgan', 'Should extract name correctly');
  assert.strictEqual(sections.Email, 'alex.morgan@example.com', 'Should extract email correctly');
  assert.strictEqual(sections.Phone, '(555) 234-5678', 'Should extract phone number correctly');
  assert(sections.Skills !== 'Missing', 'Skills should be detected');
  assert(sections.Tools !== 'Missing', 'Tools should be detected');
  assert(sections.Summary !== 'Missing', 'Summary should be detected');
  assert(sections.Education !== 'Missing', 'Education should be detected');
  assert(sections.Experience !== 'Missing', 'Experience should be detected');
  assert(sections.Projects !== 'Missing', 'Projects should be detected');
  assert(sections.Certifications !== 'Missing', 'Certifications should be detected');
  assert(sections.Achievements !== 'Missing', 'Achievements should be detected');
  console.log('✔ Test 1: Complete resume parses all 11 core sections');

  // Test 2: Structured candidate object mapping
  const candidate = parseStructuredCandidate(sweText);
  assert.strictEqual(candidate.name, 'Alex Morgan');
  assert.strictEqual(candidate.email, 'alex.morgan@example.com');
  assert(Array.isArray(candidate.skillsList), 'skillsList should be an array');
  assert(candidate.skillsList.length > 0, 'skillsList should contain items');
  assert(Array.isArray(candidate.toolsList), 'toolsList should be an array');
  assert(candidate.toolsList.length > 0, 'toolsList should contain items');
  console.log('✔ Test 2: parseStructuredCandidate returns formatted record and list arrays');

  // Test 3: Incomplete resume handles missing sections gracefully
  const incCandidate = parseStructuredCandidate(incompleteText);
  assert.strictEqual(incCandidate.name, 'John Doe');
  assert.strictEqual(incCandidate.email, 'john.doe@example.com');
  assert.strictEqual(incCandidate.phone, '', 'Missing phone should default to empty string');
  assert.strictEqual(incCandidate.summary, '', 'Missing summary should default to empty string');
  assert.strictEqual(incCandidate.certifications, '', 'Missing certs should default to empty string');
  assert.strictEqual(incCandidate.achievements, '', 'Missing achievements should default to empty string');
  console.log('✔ Test 3: Incomplete resume handles missing fields without throwing errors');
}

module.exports = runAtsParserTests;

if (require.main === module) {
  runAtsParserTests();
}
