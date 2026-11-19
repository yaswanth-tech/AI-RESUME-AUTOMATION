const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/authMiddleware');

function signDownloadToken(userId, filename) {
  const secret = getJwtSecret();
  if (!secret) {
    const error = new Error('JWT_SECRET is not configured.');
    error.status = 500;
    throw error;
  }
  return jwt.sign(
    { purpose: 'download', userId, filename },
    secret,
    { expiresIn: '30m' }
  );
}

function verifyDownloadToken(token, filename) {
  const secret = getJwtSecret();
  if (!secret) {
    const error = new Error('JWT_SECRET is not configured.');
    error.status = 500;
    throw error;
  }
  if (!token) {
    const error = new Error('A download token is required.');
    error.status = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    const error = new Error('Download link is invalid or expired.');
    error.status = 401;
    throw error;
  }

  if (decoded.purpose !== 'download' || decoded.filename !== filename || !decoded.userId) {
    const error = new Error('Download link does not match this file.');
    error.status = 403;
    throw error;
  }
  return decoded;
}

function signedDownloadPath(basePath, userId, filename) {
  const token = signDownloadToken(userId, filename);
  return `${basePath}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
}

module.exports = { signDownloadToken, verifyDownloadToken, signedDownloadPath };
