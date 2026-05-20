const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getRaces, getRaceById, getHorsesByRace, confirmRaceParticipation } = require('../controllers/raceController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Races
 *   description: Race management (public + owner endpoints)
 */

/**
 * @swagger
 * /races:
 *   get:
 *     summary: Get list of races (filter by tournament)
 *     tags: [Races]
 *     parameters:
 *       - in: query
 *         name: tournamentId
 *         schema:
 *           type: string
 *         description: Filter races by tournament ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, ONGOING, COMPLETED, CANCELLED]
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
 *         description: Paginated list of races
 */
router.get('/', getRaces);

/**
 * @swagger
 * /races/{raceId}:
 *   get:
 *     summary: Get race details
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Race details
 *       404:
 *         description: Race not found
 */
router.get('/:raceId', getRaceById);

/**
 * @swagger
 * /races/{raceId}/horses:
 *   get:
 *     summary: Get list of horses registered for a race
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of registered horses with registration status
 *       404:
 *         description: Race not found
 */
router.get('/:raceId/horses', getHorsesByRace);

/**
 * @swagger
 * /horses/me/{horseId}/confirm-race/{raceId}:
 *   patch:
 *     summary: Owner confirms horse participation in a race
 *     tags: [Races]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: raceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participation confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 registrationId:
 *                   type: string
 *                 horseId:
 *                   type: string
 *                 raceId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: CONFIRMED
 *                 confirmedByOwner:
 *                   type: boolean
 *       400:
 *         description: Registration not yet APPROVED
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Horse, Race, or Registration not found
 *       409:
 *         description: ALREADY_CONFIRMED
 */
router.patch('/me/:horseId/confirm-race/:raceId', protect, authorize('OWNER'), confirmRaceParticipation);

module.exports = router;
