const express = require('express');
const router = express.Router();
const prisma = require('../utils/prismaClient');
const { requireAuth, requireCandidate } = require('../middleware/authMiddleware');


/**
 * GET /api/user/current
 * Returns the single authenticated user.
 * Enforces existence logic.
 */
router.get('/current', requireAuth, requireCandidate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, tourCompleted: true }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load user profile.' });
  }
});

/**
 * GET /api/user/:id
 * Returns a user with their profile and diagnosis results.
 */
router.get('/:id', requireAuth, requireCandidate, async (req, res) => {
  try {
    const { id } = req.params;
    if (id !== req.user.id) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, tourCompleted: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const [studentProfile, diagnosisResult] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: id } }),
      prisma.diagnosisResult.findUnique({ where: { userId: id } })
    ]);
    res.json({ success: true, user: { ...user, studentProfile, diagnosisResult } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load user profile.' });
  }
});


/**
 * POST /api/user/complete-tour
 * Marks the product tour as completed for the user.
 */
router.post('/complete-tour', requireAuth, requireCandidate, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tourCompleted: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not update tour status.' });
  }
});

module.exports = router;
