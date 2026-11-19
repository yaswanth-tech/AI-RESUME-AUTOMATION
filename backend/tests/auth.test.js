const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'unit-test-only-jwt-secret-32-characters';
const { getJwtSecret } = require('../middleware/authMiddleware');

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
}

module.exports = runAuthTests;

if (require.main === module) {
  runAuthTests().catch(console.error);
}
