const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAdminDashboardStats,
  getPredictionRaceStats,
  getOwnerStats
} = require('../controllers/statsController');

const router = express.Router();

// Route 1: GET /admin/dashboard/stats
router.get('/admin/dashboard/stats', protect, authorize('ADMIN'), getAdminDashboardStats);

// Route 2: GET /admin/predictions/race-stats
router.get('/admin/predictions/race-stats', protect, authorize('ADMIN'), getPredictionRaceStats);

// Route 3: GET /owner/stats
router.get('/owner/stats', protect, authorize('OWNER'), getOwnerStats);

module.exports = router;
