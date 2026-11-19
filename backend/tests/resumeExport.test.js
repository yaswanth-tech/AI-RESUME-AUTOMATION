const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { parseStructuredCandidate } = require('../utils/atsParser');
const resumeExportService = require('../services/resumeExportService');
const { extractPdfText } = require('../services/documentTextService');

async function runResumeExportTests() {
  console.log('--- Running Resume Export & Template Tests ---');

  const sweText = fs.readFileSync(path.join(__dirname, 'fixtures/sample_swe_resume.txt'), 'utf8');
  const candidate = parseStructuredCandidate(sweText);
  const templates = ['Modern Clean', 'Executive Classic', 'Tech Minimal'];

  // Test 1: PDF Generation for all 3 templates
  for (const t of templates) {
    const pdfResult = await resumeExportService.generatePDF(candidate, t);
    assert(fs.existsSync(pdfResult.filePath), `PDF file must exist on disk: ${pdfResult.filename}`);
    const stats = fs.statSync(pdfResult.filePath);
    assert(stats.size > 500, `PDF must not be empty (size: ${stats.size} bytes)`);
    if (t === 'Modern Clean') {
      const extracted = await extractPdfText(fs.readFileSync(pdfResult.filePath));
      assert(extracted.text.includes(candidate.name), 'Native PDF text extraction must recover the candidate name');
      assert.strictEqual(extracted.method, 'pdf-text', 'Text-based PDFs should avoid OCR');
    }
    console.log(`✔ Generated PDF using template '${t}' (${stats.size} bytes)`);
  }

  // Test 2: DOCX Generation for all 3 templates
  for (const t of templates) {
    const docxResult = await resumeExportService.generateDOCX(candidate, t);
    assert(fs.existsSync(docxResult.filePath), `DOCX file must exist on disk: ${docxResult.filename}`);
    const stats = fs.statSync(docxResult.filePath);
    assert(stats.size > 500, `DOCX must not be empty (size: ${stats.size} bytes)`);
    console.log(`✔ Generated DOCX using template '${t}' (${stats.size} bytes)`);
  }
}

module.exports = runResumeExportTests;

if (require.main === module) {
  runResumeExportTests().catch(console.error);
}
