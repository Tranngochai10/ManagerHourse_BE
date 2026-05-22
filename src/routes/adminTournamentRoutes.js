const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { createTournament, updateTournament, deleteTournament } = require('../controllers/adminTournamentController');

const router = express.Router();

// All admin tournament routes require authentication + ADMIN role
router.use(protect, authorize('ADMIN'));

/**
 * @swagger
 * tags:
 *   name: Admin - Tournaments
 *   description: Tournament management (ADMIN only)
 */

/**
 * @swagger
 * /admin/tournaments:
 *   post:
 *     summary: Create a new tournament
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - startDate
 *               - endDate
 *               - venue
 *               - prizePool
 *               - maxHorses
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Giải Đua Ngựa Mùa Xuân 2025"
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-03-07"
 *               venue:
 *                 type: string
 *                 example: "Trường đua Phú Thọ"
 *               prizePool:
 *                 type: number
 *                 example: 500000000
 *               currency:
 *                 type: string
 *                 example: "VND"
 *               maxHorses:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       201:
 *         description: Tournament created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tournamentId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: DRAFT
 *                 createdAt:
 *                   type: string
 *       400:
 *         description: INVALID_DATE_RANGE
 *       409:
 *         description: NAME_ALREADY_EXISTS
 */
router.post('/', createTournament);

/**
 * @swagger
 * /admin/tournaments/{tournId}:
 *   put:
 *     summary: Update a tournament
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               venue:
 *                 type: string
 *               prizePool:
 *                 type: number
 *               currency:
 *                 type: string
 *               maxHorses:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Updated tournament
 *       400:
 *         description: INVALID_DATE_RANGE or validation error
 *       404:
 *         description: Tournament not found
 *       409:
 *         description: NAME_ALREADY_EXISTS
 */
router.put('/:tournId', updateTournament);

/**
 * @swagger
 * /admin/tournaments/{tournId}:
 *   delete:
 *     summary: Delete a tournament (only if not started)
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tournament deleted
 *       400:
 *         description: Cannot delete started/completed tournament
 *       404:
 *         description: Tournament not found
 */
router.delete('/:tournId', deleteTournament);

module.exports = router;
