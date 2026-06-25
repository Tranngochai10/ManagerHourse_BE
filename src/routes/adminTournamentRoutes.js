const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createTournament,
  updateTournament,
  deleteTournament,
  closeRegistration,
  generateBracket,
  updateSeeds,
  withdrawHorse,
  getAuditLogs,
} = require('../controllers/adminTournamentController');

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

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/close-registration:
 *   patch:
 *     summary: Close registration (manual or auto) and auto-reject pending
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               trigger:
 *                 type: string
 *                 enum: [manual, auto]
 *     responses:
 *       200:
 *         description: Registration closed; returns counts
 *       400:
 *         description: Invalid state
 *       404:
 *         description: Tournament not found
 */
router.patch('/:tournamentId/close-registration', closeRegistration);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/generate-bracket:
 *   post:
 *     summary: Generate bracket and create Race records per business rules
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pairingMethod:
 *                 type: string
 *                 enum: [RANDOM, SEEDED]
 *               seeds:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     horseId:
 *                       type: string
 *                     seed:
 *                       type: integer
 *               matchIntervalMinutes:
 *                 type: integer
 *               roundIntervalDays:
 *                 type: integer
 *               forceContinueIfBelowMin:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Bracket generated
 *       409:
 *         description: Conflict (e.g. approved < min and force not set)
 *       404:
 *         description: Tournament not found
 */
router.post('/:tournamentId/generate-bracket', generateBracket);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/seeds:
 *   patch:
 *     summary: Update seed assignments for tournament
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               seeds:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     horseId:
 *                       type: string
 *                     seed:
 *                       type: integer
 *               applyToExistingBracket:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated seeds
 *       409:
 *         description: Conflict
 *       404:
 *         description: Tournament not found
 */
router.patch('/:tournamentId/seeds', updateSeeds);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/withdraw/{horseId}:
 *   post:
 *     summary: Admin withdraw horse from tournament (pre/post bracket)
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal processed
 *       404:
 *         description: Not found
 */
router.post('/:tournamentId/withdraw/:horseId', withdrawHorse);

/**
 * @swagger
 * /admin/tournaments/{tournamentId}/audit-log:
 *   get:
 *     summary: Get tournament audit trail
 *     tags: [Admin - Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Audit entries
 *       404:
 *         description: Tournament not found
 */
router.get('/:tournamentId/audit-log', getAuditLogs);

module.exports = router;
