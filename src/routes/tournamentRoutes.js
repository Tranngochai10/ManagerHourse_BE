const express = require('express');
const { getTournaments, getTournamentById, getBracket, registerToTournament } = require('../controllers/tournamentController');
const { protect } = require('../middleware/authMiddleware');

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
 *           enum: [DRAFT, PUBLISHED, REGISTRATION_CLOSED, BRACKET_GENERATED, ONGOING, COMPLETED, CANCELLED]
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
 */
router.get('/', getTournaments);

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

/**
 * @swagger
 * /tournaments/{tournamentId}/bracket:
 *   get:
 *     summary: Get bracket structure for tournament
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bracket object
 *       404:
 *         description: Tournament not found or bracket not generated
 */
router.get('/:tournamentId/bracket', getBracket);

/**
 * @swagger
 * /tournaments/{tournamentId}/register:
 *   post:
 *     summary: Register horse to tournament (OWNER only)
 *     tags: [Tournaments]
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
 *             required:
 *               - horseId
 *             properties:
 *               horseId:
 *                 type: string
 *                 description: Horse ID to register
 *     responses:
 *       201:
 *         description: Successfully registered, waiting for admin approval
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       409:
 *         description: Conflict
 */
router.post('/:tournamentId/register', protect, registerToTournament);

/**
 * @swagger
 * /tournaments/{id}/bracket-with-races:
 *   get:
 *     summary: Get tournament bracket with race details
 *     tags: [Tournaments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
 *     responses:
 *       200:
 *         description: Bracket with race information
 *       404:
 *         description: Tournament not found
 */
router.get('/:id/bracket-with-races', async (req, res) => {
  try {
    const { id } = req.params;
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(id);
    
    if (!tournament) {
      return res.status(404).json({ message: 'Giải đấu không tìm thấy' });
    }

    res.status(200).json({
      bracket: tournament.bracket,
      message: 'Lấy sơ đồ thi đấu kèm race thành công'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
