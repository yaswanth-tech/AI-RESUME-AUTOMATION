const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../services/dashboardService');
const { requireAuth, requireCandidate } = require('../middleware/authMiddleware');

router.get('/stats', requireAuth, requireCandidate, async (req, res) => {
  try {
    const stats = await getDashboardStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error(JSON.stringify({ event: 'dashboard_stats_failed', status: 500 }));
    res.status(500).json({ success: false, message: 'Could not load the dashboard.' });
  }
});

// Alias for ats stats
router.get('/ats', requireAuth, requireCandidate, async (req, res) => {
  try {
    const stats = await getDashboardStats(req.user.id);
    res.json({
      ok: true,
      success: true,
      atsScore: stats.modules?.resume?.score || 0,
      status: stats.modules?.resume?.status || 'Not Started',
      data: stats
    });
  } catch (error) {
    res.status(500).json({ ok: false, success: false, message: 'Could not load dashboard data.' });
  }
});

module.exports = router;
