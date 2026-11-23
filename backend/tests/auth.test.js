const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'unit-test-only-jwt-secret-32-characters';
const prisma = require('../utils/prismaClient');
const { getJwtSecret, requireAuth } = require('../middleware/authMiddleware');

async function invokeAuth(authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

async function runAuthTests() {
  console.log('--- Running Authentication & Security Tests ---');

  const rawPassword = 'SecurePassword2026!';

  // Test 1: Password hashing and comparison
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);
  assert.notStrictEqual(hash, rawPassword, 'Hash must not equal raw password');

  const match = await bcrypt.compare(rawPassword, hash);
  assert.strictEqual(match, true, 'bcrypt.compare must verify matching password');

  const wrongMatch = await bcrypt.compare('WrongPassword', hash);
  assert.strictEqual(wrongMatch, false, 'bcrypt.compare must reject wrong password');
  console.log('✔ Test 1: Password hashing and verification passed');

  // Test 2: JWT generation and verification
  const payload = { id: 'test_user_uuid', email: 'test@example.com', name: 'Tester' };
  const secret = getJwtSecret();
  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  assert(typeof token === 'string' && token.length > 20, 'JWT must be a valid token string');

  const decoded = jwt.verify(token, secret);
  assert.strictEqual(decoded.id, payload.id);
  assert.strictEqual(decoded.email, payload.email);
  console.log('✔ Test 2: JWT token signing and verification passed');

  const originalVerify = jwt.verify;
  const originalFindUnique = prisma.user.findUnique;
  const originalConsoleError = console.error;
  try {
    const invalid = await invokeAuth('Bearer malformed-token');
    assert.strictEqual(invalid.res.statusCode, 401);
    assert.deepStrictEqual(invalid.res.body, {
      success: false,
      error: 'Your session has expired. Please log in again.'
    });

    jwt.verify = () => { throw new jwt.TokenExpiredError('jwt expired', new Date()); };
    const expired = await invokeAuth('Bearer expired-token');
    assert.strictEqual(expired.res.statusCode, 401);
    assert.strictEqual(expired.res.body.error, 'Your session has expired. Please log in again.');

    let loggedUnexpectedError = false;
    console.error = () => { loggedUnexpectedError = true; };
    jwt.verify = () => ({ id: 'test_user_uuid' });
    prisma.user.findUnique = async () => { throw new Error('test database failure'); };
    const databaseFailure = await invokeAuth('Bearer valid-shaped-token');
    assert.strictEqual(databaseFailure.res.statusCode, 500);
    assert.deepStrictEqual(databaseFailure.res.body, {
      success: false,
      error: 'Server error while checking your session.'
    });
    assert.strictEqual(loggedUnexpectedError, true, 'unexpected session lookup failures must be logged');

    prisma.user.findUnique = async () => ({ id: 'test_user_uuid', name: 'Tester' });
    const valid = await invokeAuth('Bearer valid-shaped-token');
    assert.strictEqual(valid.nextCalled, true);
    assert.strictEqual(valid.req.user.name, 'Tester');
    console.log('✔ Test 3: Session verification distinguishes expired JWTs from server failures');
  } finally {
    jwt.verify = originalVerify;
    prisma.user.findUnique = originalFindUnique;
    console.error = originalConsoleError;
  }
}

module.exports = runAuthTests;

if (require.main === module) {
  runAuthTests().catch(console.error);
}
