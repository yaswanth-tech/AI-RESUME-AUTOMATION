const assert = require('assert');
const JSZip = require('jszip');
const { inspectDocument, validateDocxPackage, sha256, MAX_UPLOAD_BYTES, isOutsideWebRoot } = require('../utils/secureUpload');

async function runSecureUploadTests() {
  console.log('--- Running Secure Upload Validation Tests ---');
  assert.strictEqual(inspectDocument(Buffer.from('%PDF-1.7'), 'resume.pdf').ok, true);
  assert.strictEqual(inspectDocument(Buffer.from('not a pdf'), 'resume.pdf').ok, false);
  assert.strictEqual(inspectDocument(Buffer.from('%PDF-1.7'), 'resume.docx').ok, false);
  assert.strictEqual(inspectDocument(Buffer.alloc(0), 'resume.pdf').ok, false);
  assert.strictEqual(inspectDocument(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'resume.pdf').ok, false);
  assert.strictEqual(inspectDocument(Buffer.from('%PDF-1.7'), 'resume.exe').ok, false);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('word/document.xml', '<document/>');
  const docx = await zip.generateAsync({ type: 'nodebuffer' });
  assert.strictEqual(inspectDocument(docx, 'resume.docx').ok, true);
  await validateDocxPackage(docx);
  await assert.rejects(() => validateDocxPackage(Buffer.from('PK\x03\x04broken')));
  assert.strictEqual(sha256(Buffer.from('same')).length, 64);
  assert.strictEqual(isOutsideWebRoot(require('path').resolve(__dirname, '../../frontend/private')), false);
  assert.strictEqual(isOutsideWebRoot(require('path').join(require('os').tmpdir(), 'ascend-test-private')), true);
  console.log('✔ Extension, size, signature, DOCX package, and content-hash checks passed');
}

module.exports = runSecureUploadTests;
