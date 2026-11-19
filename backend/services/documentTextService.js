const pdfParse = require('pdf-parse');

const MIN_NATIVE_TEXT = 40;
const MAX_OCR_PAGES = 8;

async function extractPdfText(buffer) {
  const parsed = await pdfParse(buffer);
  const nativeText = String(parsed.text || '').trim();
  if (nativeText.length >= MIN_NATIVE_TEXT) return { text: nativeText, method: 'pdf-text' };

  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const { createCanvas } = require('@napi-rs/canvas');
  const { createWorker } = require('tesseract.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false }).promise;
  if (doc.numPages > MAX_OCR_PAGES) {
    await doc.destroy();
    const error = new Error(`Scanned PDFs are limited to ${MAX_OCR_PAGES} pages for OCR. Please upload a shorter file.`);
    error.status = 400;
    throw error;
  }

  let worker;
  try {
    worker = await createWorker(process.env.OCR_LANGUAGES || 'eng', 1, {
      langPath: process.env.TESSDATA_DIR || undefined,
      cachePath: process.env.TESSERACT_CACHE_DIR || undefined,
      gzip: true
    });
    const pages = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const image = canvas.toBuffer('image/png');
      const result = await worker.recognize(image);
      pages.push(String(result.data.text || '').trim());
      page.cleanup();
    }
    const ocrText = pages.filter(Boolean).join('\n\n').trim();
    return { text: ocrText || nativeText, method: ocrText ? 'tesseract-ocr' : 'pdf-text' };
  } finally {
    if (worker) await worker.terminate();
    await doc.destroy();
  }
}

module.exports = { extractPdfText, MIN_NATIVE_TEXT, MAX_OCR_PAGES };
