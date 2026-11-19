const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');
const { requireAuth, getJwtSecret } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Helper to generate JWT token (expires in 7 days)
function generateToken(user) {
  const secret = getJwtSecret();
  if (!secret) {
    const error = new Error('Server authentication is not configured. Set JWT_SECRET in backend/.env.');
    error.status = 500;
    throw error;
  }
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/signup
 * Creates a new user with hashed password
 */
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (min 2 characters).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered (case‑insensitive)
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        tourCompleted: true,
        createdAt: true
      }
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'signup_failed', status: error.status || 500 }));
    res.status(500).json({ success: false, error: 'Failed to create account.' });
  }
});

/**
 * POST /api/auth/login
 * Verifies email/password and returns JWT token
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    // Normalise identifier – prioritize explicit email field for clarity
    const identifier = (email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/username and password are required.' });
    }

    // Prefer email lookup for deterministic behaviour
    let user = await prisma.user.findUnique({
      where: { email: identifier }
    });
    // Fallback to username (stored in name) if not found by email
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          name: { equals: identifier, mode: 'insensitive' }
        }
      });
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      tourCompleted: user.tourCompleted
    };

    const token = generateToken(safeUser);

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'login_failed', status: error.status || 500 }));
    res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
