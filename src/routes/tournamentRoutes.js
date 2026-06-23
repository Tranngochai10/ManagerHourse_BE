const express = require('express');
const { getTournaments, getTournamentById, registerToTournament } = require('../controllers/tournamentController');
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
 *           enum: [DRAFT, PUBLISHED, ONGOING, COMPLETED, CANCELLED]
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
 * /tournaments/{tournamentId}/register:
 *   post:
 *     summary: Đăng ký ngựa vào tournament (chỉ OWNER)
 *     tags: [Tournaments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tournament ID
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
 *                 description: ID của ngựa muốn đăng ký
 *                 example: "665f1a2b3c4d5e6f7a8b9c0d"
 *     responses:
 *       201:
 *         description: Đăng ký thành công, chờ admin duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 registrationId:
 *                   type: string
 *                 tournamentId:
 *                   type: string
 *                 horseId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: PENDING
 *                 createdAt:
 *                   type: string
 *       400:
 *         description: Tournament đóng đăng ký / ngựa chưa APPROVED / đầy slot
 *       403:
 *         description: Không phải OWNER hoặc không sở hữu ngựa này
 *       404:
 *         description: Tournament hoặc Horse không tồn tại
 *       409:
 *         description: Ngựa đã đăng ký tournament này rồi
 */
router.post('/:tournamentId/register', protect, registerToTournament);

module.exports = router;
