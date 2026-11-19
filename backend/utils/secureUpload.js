const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PRIVATE_RESUME_DIR = path.resolve(
  process.env.RESUME_STORAGE_DIR || path.join(os.tmpdir(), 'ascend-private', 'resumes')
);
const FRONTEND_WEB_ROOT = path.resolve(__dirname, '../../frontend');

function isOutsideWebRoot(candidatePath = PRIVATE_RESUME_DIR) {
  const relative = path.relative(FRONTEND_WEB_ROOT, path.resolve(candidatePath));
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

if (!isOutsideWebRoot()) throw new Error('RESUME_STORAGE_DIR must be outside the frontend static directory.');

function inspectDocument(buffer, originalName) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, reason: 'The uploaded file is empty.' };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'The uploaded file exceeds the 5 MiB limit.' };
  }
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (ext === '.pdf') {
    const signature = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
    return signature.includes('%PDF-')
      ? { ok: true, ext, mimeType: 'application/pdf' }
      : { ok: false, reason: 'The file extension does not match a valid PDF signature.' };
  }
  if (ext !== '.docx') {
    return { ok: false, reason: 'Only PDF and DOCX files are supported.' };
  }
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return { ok: false, reason: 'The file extension does not match a DOCX ZIP signature.' };
  }
  return { ok: true, ext, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

async function validateDocxPackage(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
  } catch {
    const error = new Error('The uploaded DOCX package is damaged or invalid.');
    error.status = 400;
    throw error;
  }
  const names = Object.keys(zip.files);
  if (names.length > 2000 || names.some(name => name.startsWith('/') || name.split('/').includes('..'))) {
    const error = new Error('The DOCX package contains unsupported paths or too many entries.');
    error.status = 400;
    throw error;
  }
  const totalSize = names.reduce((sum, name) => sum + (zip.files[name].unsafeOriginalName ? 0 : (zip.files[name]._data?.uncompressedSize || 0)), 0);
  if (totalSize > 25 * 1024 * 1024 || !zip.file('[Content_Types].xml') || !zip.file('word/document.xml')) {
    const error = new Error('The uploaded ZIP is not a supported DOCX document.');
    error.status = 400;
    throw error;
  }
}

async function storeResume(buffer, ext) {
  await fs.mkdir(PRIVATE_RESUME_DIR, { recursive: true, mode: 0o700 });
  const storageKey = `${crypto.randomUUID()}${ext}`;
  const absolutePath = path.join(PRIVATE_RESUME_DIR, storageKey);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o600 });
  return { storageKey, absolutePath };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { MAX_UPLOAD_BYTES, PRIVATE_RESUME_DIR, inspectDocument, validateDocxPackage, storeResume, sha256, isOutsideWebRoot };
