const assert = require('assert');
const { inspectDocument, validateDocxPackage, MAX_UPLOAD_BYTES } = require('../utils/secureUpload');

async function runUploadValidationTests() {
  console.log('--- Running Resume Upload Validation Tests ---');

  // Test 1: Empty file buffer rejection
  const emptyBuf = Buffer.alloc(0);
  const emptyRes = inspectDocument(emptyBuf, 'resume.pdf');
  assert.strictEqual(emptyRes.ok, false, 'Empty file must be rejected');
  assert(emptyRes.reason.includes('empty'), 'Reason must specify empty file');
  console.log('✔ Test 1: Empty file correctly rejected');

  // Test 2: File exceeding 5MB limit rejection
  const oversizedBuf = Buffer.alloc(MAX_UPLOAD_BYTES + 1024);
  const oversizedRes = inspectDocument(oversizedBuf, 'large.pdf');
  assert.strictEqual(oversizedRes.ok, false, 'File >5MB must be rejected');
  assert(oversizedRes.reason.includes('5 MiB'), 'Reason must mention 5 MiB limit');
  console.log('✔ Test 2: Oversized file (>5MB) correctly rejected');

  // Test 3: Spoofed extension - text disguised as .pdf
  const fakePdfBuf = Buffer.from('This is just plain text, not a real PDF document.');
  const fakePdfRes = inspectDocument(fakePdfBuf, 'fake.pdf');
  assert.strictEqual(fakePdfRes.ok, false, 'Plain text with .pdf extension must fail PDF signature check');
  assert(fakePdfRes.reason.includes('PDF signature'), 'Reason must mention invalid PDF signature');
  console.log('✔ Test 3: Spoofed PDF extension without %PDF header rejected');

  // Test 4: Valid PDF with %PDF header
  const validPdfBuf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  const validPdfRes = inspectDocument(validPdfBuf, 'valid_resume.pdf');
  assert.strictEqual(validPdfRes.ok, true, 'Valid PDF buffer must be accepted');
  assert.strictEqual(validPdfRes.ext, '.pdf');
  assert.strictEqual(validPdfRes.mimeType, 'application/pdf');
  console.log('✔ Test 4: Valid PDF buffer accepted');

  // Test 5: Unsupported file extension
  const txtBuf = Buffer.from('Some text');
  const txtRes = inspectDocument(txtBuf, 'resume.txt');
  assert.strictEqual(txtRes.ok, false, 'TXT files must be rejected');
  assert(txtRes.reason.includes('Only PDF and DOCX'), 'Reason must state PDF and DOCX only');
  console.log('✔ Test 5: Unsupported file format (.txt) correctly rejected');

  // Test 6: Spoofed DOCX extension without ZIP signature
  const fakeDocxBuf = Buffer.from('Hello world invalid zip');
  const fakeDocxRes = inspectDocument(fakeDocxBuf, 'resume.docx');
  assert.strictEqual(fakeDocxRes.ok, false, 'Invalid DOCX header must be rejected');
  assert(fakeDocxRes.reason.includes('DOCX ZIP signature'), 'Reason must mention DOCX signature');
  console.log('✔ Test 6: Spoofed DOCX extension rejected');

  // Test 7: Target role length validation
  function validateTargetRole(targetRole) {
    if (!targetRole || typeof targetRole !== 'string' || targetRole.trim().length < 2 || targetRole.length > 80) {
      return { ok: false, error: 'Target Job Role must be selected before analysis.' };
    }
    return { ok: true };
  }

  assert.strictEqual(validateTargetRole('').ok, false, 'Empty role must fail');
  assert.strictEqual(validateTargetRole('A').ok, false, 'Single char role must fail');
  assert.strictEqual(validateTargetRole('X'.repeat(81)).ok, false, 'Role > 80 chars must fail');
  assert.strictEqual(validateTargetRole('Software Engineer').ok, true, 'Valid role must pass');
  console.log('✔ Test 7: Target job role boundary validations verified');
}

module.exports = runUploadValidationTests;

if (require.main === module) {
  runUploadValidationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
