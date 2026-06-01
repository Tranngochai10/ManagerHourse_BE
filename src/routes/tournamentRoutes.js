const express = require('express');
const { getTournaments, getTournamentById } = require('../controllers/tournamentController');
const { getTournamentLeaderboard } = require('../controllers/resultController'); // FIX: alias route

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tournaments
 *   description: Tournament management (public endpoints)
 */

/**
 * @swagger
 * /tournaments:
 *   get:
 *     summary: Get list of tournaments
 *     tags: [Tournaments]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ACTIVE, PUBLISHED, ONGOING, COMPLETED, CANCELLED]
 *         description: Filter by tournament status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated list of tournaments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 tournaments:
 *                   type: array
 */
router.get('/', getTournaments);

/**
 * @swagger
 * /tournaments/{tournId}/leaderboard:
 *   get:
 *     summary: Get tournament leaderboard (alias)
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament leaderboard
 */
// FIX: route alias phải đặt TRƯỚC /:tournId để tránh Express parse 'leaderboard' như ID
router.get('/:tournId/leaderboard', getTournamentLeaderboard);

/**
 * @swagger
 * /tournaments/{tournId}:
 *   get:
 *     summary: Get tournament details
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
 *     responses:
 *       200:
 *         description: Tournament details
 *       404:
 *         description: Tournament not found
 */
router.get('/:tournId', getTournamentById);

module.exports = router;
